"""Perfil de búsqueda: define qué procesos le interesan a una empresa.

El rastreador usa estos criterios para emparejar oportunidades de SECOP.
"""
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Boolean, ForeignKey, JSON, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SearchProfile(Base):
    __tablename__ = "search_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Mi búsqueda")
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Lista de palabras clave, p.ej. ["catering", "alimentación", "refrigerios"]
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    # Palabras que DESCARTAN una oportunidad aunque coincidan las keywords.
    # Ej.: "animal", "veterinario" para que "alimentación animal" no entre.
    exclude_keywords: Mapped[list] = mapped_column(JSON, default=list)
    # Alcance geográfico. Si se fija departamento, el radar busca en todo el
    # departamento; ciudad lo acota aún más. Cada uno filtra solo si está puesto.
    ciudad: Mapped[str | None] = mapped_column(String(120), nullable=True)
    departamento: Mapped[str | None] = mapped_column(String(120), nullable=True)
    presupuesto_min: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    presupuesto_max: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    company: Mapped["Company"] = relationship(back_populates="search_profiles")  # noqa: F821
