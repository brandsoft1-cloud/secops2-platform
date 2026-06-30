"""Espejo local de SECOP: ingiere procesos a la BD y los consulta rápido.

En vez de preguntarle a SECOP en cada clic (lento e inestable: 0.6s–31s),
copiamos los procesos a la tabla `opportunities` y consultamos la BD local
(milisegundos, cualquier rango/filtro). El rastreador mantiene fresco el espejo.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity
from app.models.search_profile import SearchProfile
from app.services import secop

logger = logging.getLogger("mirror")


def ingestar(
    db: Session,
    *,
    departamento: str | None = None,
    dias: int = 730,
    max_paginas: int = 40,
    page_size: int = 1000,
) -> int:
    """Trae procesos de SECOP (por departamento/rango) y los guarda en la BD.

    Hace upsert por secop_id (no duplica). Devuelve cuántos NUEVOS guardó.
    """
    nuevos = 0
    for pagina in range(max_paginas):
        filas = secop.fetch_pagina(
            offset=pagina * page_size,
            limit=page_size,
            estados=None,  # todo lo del rango, no solo abiertos (espejo completo)
            desde_dias=dias,
            departamento=departamento,
        )
        if not filas:
            break
        # Dedup por secop_id dentro de la tanda (SECOP repite filas por proceso),
        # luego upsert escalable con ON CONFLICT DO NOTHING (no carga todo en RAM).
        unicos = list({f["secop_id"]: f for f in filas}.values())
        stmt = (
            pg_insert(Opportunity)
            .values(unicos)
            .on_conflict_do_nothing(index_elements=["secop_id"])
            .returning(Opportunity.id)
        )
        nuevos += len(db.execute(stmt).fetchall())
        db.commit()
        logger.info("Espejo %s: página %d (+%d nuevos acumulados)", departamento or "global", pagina, nuevos)
        if len(filas) < page_size:
            break
    return nuevos


def refrescar_global(db: Session, *, dias: int = 30) -> dict:
    """Refresca el espejo para todas las zonas con perfiles activos (lo usa el worker)."""
    deptos = {
        p.departamento
        for p in db.scalars(select(SearchProfile).where(SearchProfile.active.is_(True))).all()
        if p.departamento
    }
    nuevos = 0
    for depto in deptos:
        nuevos += ingestar(db, departamento=depto, dias=dias)
    return {"departamentos": sorted(deptos), "nuevos": nuevos}


def _filtrar(
    stmt,
    *,
    departamento: str | None = None,
    ciudad: str | None = None,
    keywords: list[str] | None = None,
    exclude: list[str] | None = None,
    unspsc: list[str] | None = None,
    modalidades: list[str] | None = None,
    desde_dias: int | None = None,
):
    """Aplica los criterios del perfil a un select (compartido lista/conteo)."""
    if desde_dias:
        corte = datetime.now(timezone.utc) - timedelta(days=desde_dias)
        stmt = stmt.where(Opportunity.fecha_publicacion >= corte)
    if departamento:
        stmt = stmt.where(Opportunity.departamento.ilike(f"%{departamento}%"))
    if ciudad:
        stmt = stmt.where(Opportunity.ciudad.ilike(f"%{ciudad}%"))
    if modalidades:
        stmt = stmt.where(Opportunity.modalidad.in_(modalidades))

    # Inclusión por OR: alguna keyword en el objeto, o alguna clase UNSPSC (6 díg).
    # El overlap (&&) sobre el array unspsc_clases usa índice GIN (rápido).
    incl = [Opportunity.objeto.ilike(f"%{kw}%") for kw in (keywords or [])]
    clases = sorted({str(c)[:6] for c in (unspsc or []) if str(c)[:6]})
    if clases:
        incl.append(Opportunity.unspsc_clases.overlap(clases))
    if incl:
        stmt = stmt.where(or_(*incl))

    for ex in (exclude or []):
        if ex:
            stmt = stmt.where(~Opportunity.objeto.ilike(f"%{ex}%"))
    return stmt


def consultar_local(db: Session, *, offset: int = 0, limit: int = 10, **filtros) -> list[Opportunity]:
    """Consulta el espejo local con los criterios del perfil (rápido, indexado)."""
    stmt = _filtrar(select(Opportunity), **filtros)
    stmt = stmt.order_by(Opportunity.fecha_publicacion.desc().nullslast()).offset(offset).limit(limit)
    return list(db.scalars(stmt).all())


def contar_local(db: Session, **filtros) -> int:
    """Total de procesos del espejo que cumplen el filtro."""
    stmt = _filtrar(select(func.count()).select_from(Opportunity), **filtros)
    return db.scalar(stmt) or 0
