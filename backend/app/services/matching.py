"""Lógica de emparejamiento: ¿esta oportunidad le sirve a este perfil?"""
from __future__ import annotations

import unicodedata

from app.models.opportunity import Opportunity
from app.models.search_profile import SearchProfile


def _normaliza_texto(texto: str | None) -> str:
    if not texto:
        return ""
    # Quita tildes y pasa a minúsculas para comparar sin acentos
    nfkd = unicodedata.normalize("NFKD", texto)
    sin_tildes = "".join(c for c in nfkd if not unicodedata.combining(c))
    return sin_tildes.lower()


def coincide(opp: Opportunity, profile: SearchProfile) -> bool:
    """True si la oportunidad cumple los criterios del perfil de búsqueda."""
    if not profile.active:
        return False

    # Ciudad (si el perfil la especifica)
    if profile.ciudad:
        if _normaliza_texto(profile.ciudad) not in _normaliza_texto(opp.ciudad):
            return False

    # Presupuesto
    if opp.valor is not None:
        if profile.presupuesto_min is not None and opp.valor < float(profile.presupuesto_min):
            return False
        if profile.presupuesto_max is not None and opp.valor > float(profile.presupuesto_max):
            return False

    # Palabras clave: al menos una debe aparecer en entidad/objeto/sector
    if profile.keywords:
        texto = _normaliza_texto(" ".join(filter(None, [opp.objeto, opp.entidad, opp.estado_secop])))
        if not any(_normaliza_texto(kw) in texto for kw in profile.keywords):
            return False

    return True


def perfiles_que_coinciden(opp: Opportunity, profiles: list[SearchProfile]) -> list[SearchProfile]:
    return [p for p in profiles if coincide(opp, p)]
