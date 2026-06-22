"""Postulacion = el mini-CRM. Relaciona una empresa con una oportunidad y
lleva el estado de su gestión: Nueva -> Revisando -> Postulada -> Ganada/Descartada.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EstadoPostulacion(str, enum.Enum):
    NUEVA = "nueva"
    REVISANDO = "revisando"
    POSTULADA = "postulada"
    GANADA = "ganada"
    DESCARTADA = "descartada"


class Postulacion(Base):
    __tablename__ = "postulaciones"
    __table_args__ = (
        UniqueConstraint("company_id", "opportunity_id", name="uq_company_opportunity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    estado: Mapped[EstadoPostulacion] = mapped_column(
        Enum(EstadoPostulacion), default=EstadoPostulacion.NUEVA
    )
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"))

    company: Mapped["Company"] = relationship(back_populates="postulaciones")  # noqa: F821
    opportunity: Mapped["Opportunity"] = relationship()  # noqa: F821
