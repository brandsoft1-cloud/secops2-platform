"""Planes: límites por plan y guards que los hacen cumplir.

Lo que se limita: nº de perfiles de búsqueda, nº de usuarios y análisis de IA
por mes (lo que cuesta plata en OpenRouter). El trial de 14 días da acceso Pro.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.company import Company, Plan
from app.models.search_profile import SearchProfile
from app.models.user import User


# Límites por plan. Usa un número grande para "prácticamente ilimitado".
LIMITES: dict[Plan, dict[str, int]] = {
    Plan.GRATIS:   {"perfiles": 1,  "usuarios": 1,  "ia_mes": 5},
    Plan.ESENCIAL: {"perfiles": 3,  "usuarios": 3,  "ia_mes": 50},
    Plan.PRO:      {"perfiles": 10, "usuarios": 8,  "ia_mes": 300},
    Plan.AGENCIA:  {"perfiles": 50, "usuarios": 25, "ia_mes": 3000},
}


def plan_efectivo(company: Company) -> Plan:
    """Plan vigente: durante el trial (14 días) se da acceso Pro."""
    if company.trial_ends_at and company.trial_ends_at > datetime.now(timezone.utc):
        return Plan.PRO
    return company.plan


def limites(company: Company) -> dict[str, int]:
    return LIMITES[plan_efectivo(company)]


def _periodo_actual() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _403(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def exigir_cupo_perfil(company: Company, db: Session) -> None:
    n = db.scalar(select(func.count()).select_from(SearchProfile).where(SearchProfile.company_id == company.id))
    tope = limites(company)["perfiles"]
    if n >= tope:
        raise _403(f"Tu plan permite {tope} perfil(es). Mejora tu plan para crear más.")


def exigir_cupo_usuario(company: Company, db: Session) -> None:
    n = db.scalar(select(func.count()).select_from(User).where(User.company_id == company.id))
    tope = limites(company)["usuarios"]
    if n >= tope:
        raise _403(f"Tu plan permite {tope} usuario(s). Mejora tu plan para agregar más.")


def verificar_cupo_ia(company: Company) -> None:
    """Lanza 403 si ya se agotó el cupo de IA del mes (no incrementa)."""
    periodo = _periodo_actual()
    usados = company.ia_uso_mes if company.ia_uso_periodo == periodo else 0
    tope = limites(company)["ia_mes"]
    if usados >= tope:
        raise _403(f"Alcanzaste el límite de {tope} análisis con IA de tu plan este mes. Mejora tu plan.")


def registrar_uso_ia(company: Company, db: Session) -> None:
    """Suma 1 al consumo de IA del mes (tras un análisis exitoso)."""
    periodo = _periodo_actual()
    if company.ia_uso_periodo != periodo:
        company.ia_uso_periodo = periodo
        company.ia_uso_mes = 0
    company.ia_uso_mes += 1
    db.commit()


def estado_plan(company: Company, db: Session) -> dict:
    """Resumen del plan y consumo (para el frontend)."""
    lim = limites(company)
    periodo = _periodo_actual()
    return {
        "plan": plan_efectivo(company).value,
        "plan_base": company.plan.value,
        "en_trial": plan_efectivo(company) != company.plan,
        "trial_ends_at": company.trial_ends_at,
        "limites": lim,
        "uso": {
            "perfiles": db.scalar(select(func.count()).select_from(SearchProfile).where(SearchProfile.company_id == company.id)),
            "usuarios": db.scalar(select(func.count()).select_from(User).where(User.company_id == company.id)),
            "ia_mes": company.ia_uso_mes if company.ia_uso_periodo == periodo else 0,
        },
    }
