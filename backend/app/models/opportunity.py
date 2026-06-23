"""Oportunidad = proceso de contratación traído de SECOP II.

Es global (compartida entre empresas). Cada empresa la relaciona con una
Postulacion para llevar su propio estado en el CRM.
"""
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Numeric, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[int] = mapped_column(primary_key=True)
    # ID del proceso en SECOP (clave para detectar duplicados / nuevos)
    secop_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    entidad: Mapped[str | None] = mapped_column(String(300), nullable=True)
    objeto: Mapped[str | None] = mapped_column(Text, nullable=True)
    valor: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    ciudad: Mapped[str | None] = mapped_column(String(120), index=True, nullable=True)
    departamento: Mapped[str | None] = mapped_column(String(120), nullable=True)
    estado_secop: Mapped[str | None] = mapped_column(String(120), nullable=True)
    modalidad: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tipo_contrato: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fecha_publicacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fecha_cierre: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Respuesta cruda de SECOP por si se necesita más adelante
    raw: Mapped[dict] = mapped_column(JSON, default=dict)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
