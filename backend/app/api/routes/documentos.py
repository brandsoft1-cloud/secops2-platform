"""Documentos por postulación: repositorio para preparar la oferta.

Guarda los archivos en disco local (settings.storage_dir). La presentación
legal se sigue haciendo en el portal de SECOP; aquí solo se organizan.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.documento import Documento
from app.models.postulacion import Postulacion
from app.models.user import User
from app.schemas.opportunity import DocumentoOut

router = APIRouter(prefix="/api", tags=["documentos"])


def _postulacion_de(db: Session, postulacion_id: int, user: User) -> Postulacion:
    post = db.get(Postulacion, postulacion_id)
    if not post or post.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Postulación no encontrada")
    return post


def _documento_de(db: Session, documento_id: int, user: User) -> Documento:
    doc = db.get(Documento, documento_id)
    if not doc or doc.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return doc


@router.get("/postulaciones/{postulacion_id}/documentos", response_model=list[DocumentoOut])
def listar(
    postulacion_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _postulacion_de(db, postulacion_id, current)
    return db.scalars(
        select(Documento)
        .where(Documento.postulacion_id == postulacion_id)
        .order_by(Documento.created_at.desc())
    ).all()


@router.post(
    "/postulaciones/{postulacion_id}/documentos",
    response_model=DocumentoOut,
    status_code=status.HTTP_201_CREATED,
)
async def subir(
    postulacion_id: int,
    archivo: UploadFile,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _postulacion_de(db, postulacion_id, current)

    contenido = await archivo.read()
    if len(contenido) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"El archivo supera {settings.max_upload_mb} MB")

    # Guarda en storage_dir/<company_id>/<uuid>_<nombre>
    carpeta = Path(settings.storage_dir) / str(current.company_id)
    carpeta.mkdir(parents=True, exist_ok=True)
    nombre_seguro = Path(archivo.filename or "archivo").name
    ruta_rel = Path(str(current.company_id)) / f"{uuid.uuid4().hex}_{nombre_seguro}"
    (Path(settings.storage_dir) / ruta_rel).write_bytes(contenido)

    doc = Documento(
        nombre=nombre_seguro,
        content_type=archivo.content_type,
        tamano=len(contenido),
        ruta=str(ruta_rel),
        company_id=current.company_id,
        postulacion_id=postulacion_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/documentos/{documento_id}/download")
def descargar(
    documento_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _documento_de(db, documento_id, current)
    ruta = Path(settings.storage_dir) / doc.ruta
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado en almacenamiento")
    return FileResponse(ruta, filename=doc.nombre, media_type=doc.content_type or "application/octet-stream")


@router.delete("/documentos/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    documento_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = _documento_de(db, documento_id, current)
    ruta = Path(settings.storage_dir) / doc.ruta
    ruta.unlink(missing_ok=True)
    db.delete(doc)
    db.commit()
