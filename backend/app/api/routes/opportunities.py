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
from app.models.postulacion import EstadoPostulacion, Postulacion
from app.models.user import User
from app.schemas.opportunity import PostulacionOut, PostulacionUpdate

router = APIRouter(prefix="/api/opportunities", tags=["oportunidades"])


@router.get("", response_model=list[PostulacionOut])
def listar(
    estado: EstadoPostulacion | None = Query(default=None),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista las oportunidades de la empresa (su panel/CRM), opcionalmente por estado."""
    stmt = (
        select(Postulacion)
        .options(joinedload(Postulacion.opportunity))
        .where(Postulacion.company_id == current.company_id)
        .order_by(Postulacion.updated_at.desc())
    )
    if estado is not None:
        stmt = stmt.where(Postulacion.estado == estado)
    return db.scalars(stmt).all()


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
    db.commit()
    db.refresh(post)
    return post
