"""Empresa cliente del SaaS. Agrupa usuarios, perfiles de búsqueda y postulaciones."""
import enum
from datetime import datetime, timezone, timedelta

from sqlalchemy import String, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Plan(str, enum.Enum):
    GRATIS = "gratis"
    ESENCIAL = "esencial"
    PRO = "pro"
    AGENCIA = "agencia"


def _trial_end() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=14)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    nit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    plan: Mapped[Plan] = mapped_column(Enum(Plan), default=Plan.GRATIS)
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_trial_end)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    users: Mapped[list["User"]] = relationship(back_populates="company")  # noqa: F821
    search_profiles: Mapped[list["SearchProfile"]] = relationship(  # noqa: F821
        back_populates="company", cascade="all, delete-orphan"
    )
    postulaciones: Mapped[list["Postulacion"]] = relationship(  # noqa: F821
        back_populates="company", cascade="all, delete-orphan"
    )
