"""Oportunidades de la empresa y gestión CRM (postulaciones).

Cuando el rastreador encuentra un proceso que coincide con un perfil, crea una
Postulacion en estado NUEVA para esa empresa. Estos endpoints exponen y
actualizan esas postulaciones.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.company import Company
from app.models.postulacion import EstadoPostulacion, Postulacion
from app.models.search_profile import SearchProfile
from app.models.user import User
from app.config import settings
from app.models.opportunity import Opportunity
from app.schemas.opportunity import (
    BuscarResult,
    ExploreOut,
    PostulacionOut,
    PostulacionUpdate,
    SeguirRequest,
)
from app.services import ia, secop

router = APIRouter(prefix="/api/opportunities", tags=["oportunidades"])


@router.post("/buscar", response_model=BuscarResult)
def buscar(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Dispara una búsqueda en SECOP para la empresa y devuelve cuántas nuevas halló.

    Es el botón "Buscar ahora": el usuario controla y ve el resultado al instante.
    """
    # Import diferido: el worker es opcional y trae dependencias de red.
    from worker.rastreador import ejecutar_pasada

    nuevas = ejecutar_pasada(company_id=current.company_id)
    company = db.get(Company, current.company_id)
    return BuscarResult(nuevas=nuevas, last_searched_at=company.last_searched_at if company else None)


@router.get("", response_model=list[PostulacionOut])
def listar(
    estado: EstadoPostulacion | None = Query(default=None),
    profile_id: int | None = Query(default=None),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista las oportunidades de la empresa, opcionalmente por estado y/o perfil.

    Con profile_id, devuelve solo las que coinciden con ese perfil (usando la
    misma lógica de matching, así no se duplica criterio en el frontend).
    """
    stmt = (
        select(Postulacion)
        .options(joinedload(Postulacion.opportunity), joinedload(Postulacion.assignee))
        .where(Postulacion.company_id == current.company_id)
        .order_by(Postulacion.updated_at.desc())
    )
    if estado is not None:
        stmt = stmt.where(Postulacion.estado == estado)
    posts = db.scalars(stmt).all()

    if profile_id is not None:
        from app.services.matching import coincide

        perfil = db.get(SearchProfile, profile_id)
        if not perfil or perfil.company_id != current.company_id:
            raise HTTPException(status_code=404, detail="Perfil no encontrado")
        posts = [p for p in posts if coincide(p.opportunity, perfil)]
    return posts


def _filtros_explorar(profile_id, dias, current, db) -> dict:
    """Arma los filtros de SECOP según el rango (días) y, si aplica, el perfil."""
    filtros: dict = {
        "estados": settings.secop_estados_abiertos,
        "desde_dias": dias,
    }
    if profile_id is not None:
        perfil = db.get(SearchProfile, profile_id)
        if not perfil or perfil.company_id != current.company_id:
            raise HTTPException(status_code=404, detail="Perfil no encontrado")
        filtros.update(
            departamento=perfil.departamento,
            ciudad=perfil.ciudad,
            keywords=perfil.keywords,
            exclude=perfil.exclude_keywords,
            unspsc=perfil.unspsc_codes,
            modalidades=perfil.modalidades,
        )
    return filtros


@router.get("/explorar", response_model=list[ExploreOut])
def explorar(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=50),
    profile_id: int | None = Query(default=None),
    dias: int = Query(default=30, ge=1, le=1825),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Explorador (consulta en vivo a SECOP II, paginada de N en N).

    `dias` define el rango hacia atrás (30, 180, 365, 730…). Con profile_id,
    además filtra por los criterios del perfil (zona + keywords/UNSPSC + exclusiones).
    """
    filtros = _filtros_explorar(profile_id, dias, current, db)
    db.close()  # libera la conexión a la BD antes de la llamada lenta a SECOP
    return secop.fetch_pagina(offset=offset, limit=limit, **filtros)


@router.get("/explorar/total")
def explorar_total(
    profile_id: int | None = Query(default=None),
    dias: int = Query(default=30, ge=1, le=1825),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Total que cumple el filtro/rango (para el contador "Encontrados: N")."""
    filtros = _filtros_explorar(profile_id, dias, current, db)
    db.close()  # libera la conexión a la BD antes de la llamada lenta a SECOP
    return {"total": secop.contar(**filtros)}


@router.post("/seguir", response_model=PostulacionOut)
def seguir(
    data: SeguirRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sigue un proceso del explorador: lo guarda y lo agrega al panel de la empresa."""
    opp = db.scalar(select(Opportunity).where(Opportunity.secop_id == data.secop_id))
    if not opp:
        datos = secop.fetch_uno(data.secop_id)
        if not datos:
            raise HTTPException(status_code=404, detail="Proceso no encontrado en SECOP")
        opp = Opportunity(**datos)
        db.add(opp)
        db.flush()

    post = db.scalar(
        select(Postulacion).where(
            Postulacion.company_id == current.company_id,
            Postulacion.opportunity_id == opp.id,
        )
    )
    if not post:
        post = Postulacion(company_id=current.company_id, opportunity_id=opp.id)
        db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.patch("/{postulacion_id}", response_model=PostulacionOut)
def actualizar(
    postulacion_id: int,
    data: PostulacionUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cambia el estado del CRM (Nueva → Revisando → Postulada → Ganada/Descartada) o las notas."""
    post = db.get(Postulacion, postulacion_id)
    if not post or post.company_id != current.company_id:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")
    if data.estado is not None:
        post.estado = data.estado
    if data.notas is not None:
        post.notas = data.notas
    if data.set_assignee:
        if data.assignee_id is not None:
            asignado = db.get(User, data.assignee_id)
            if not asignado or asignado.company_id != current.company_id:
                raise HTTPException(status_code=400, detail="Responsable inválido")
        post.assignee_id = data.assignee_id
    db.commit()
    db.refresh(post)
    return post


def _get_postulacion(postulacion_id: int, current: User, db: Session) -> Postulacion:
    post = db.get(Postulacion, postulacion_id)
    if not post or post.company_id != current.company_id:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")
    return post


@router.post("/{postulacion_id}/analizar", response_model=PostulacionOut)
def analizar(
    postulacion_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resume la oportunidad con IA y puntúa su afinidad con el perfil de la empresa."""
    post = _get_postulacion(postulacion_id, current, db)
    perfil = db.scalar(
        select(SearchProfile)
        .where(SearchProfile.company_id == current.company_id, SearchProfile.active.is_(True))
        .order_by(SearchProfile.id)
    )
    analisis = ia.analizar_afinidad(post.opportunity, perfil)
    if analisis is None:
        raise HTTPException(status_code=503, detail="El análisis con IA no está disponible")
    post.ia_resumen = analisis.resumen
    post.ia_afinidad = analisis.afinidad
    post.ia_motivo = analisis.motivo
    db.commit()
    db.refresh(post)
    return post


@router.post("/{postulacion_id}/asistente", response_model=PostulacionOut)
def asistente(
    postulacion_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Genera un checklist de requisitos y un borrador de carta de presentación con IA."""
    post = _get_postulacion(postulacion_id, current, db)
    company = db.get(Company, current.company_id)
    resultado = ia.generar_asistente(post.opportunity, company.name if company else "la empresa")
    if resultado is None:
        raise HTTPException(status_code=503, detail="El asistente con IA no está disponible")
    post.ia_checklist = resultado.checklist
    post.ia_carta = resultado.carta
    db.commit()
    db.refresh(post)
    return post
