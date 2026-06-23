"""Documento adjunto a una postulación (su repositorio para preparar la oferta).

Los archivos se guardan en disco local (settings.storage_dir); la fila guarda
los metadatos y la ruta relativa. La presentación legal sigue siendo en SECOP.
"""
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Documento(Base):
    __tablename__ = "documentos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tamano: Mapped[int] = mapped_column(Integer, default=0)  # bytes
    ruta: Mapped[str] = mapped_column(String(500))  # relativa a storage_dir
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    postulacion_id: Mapped[int] = mapped_column(
        ForeignKey("postulaciones.id", ondelete="CASCADE")
    )
    postulacion: Mapped["Postulacion"] = relationship(back_populates="documentos")  # noqa: F821
