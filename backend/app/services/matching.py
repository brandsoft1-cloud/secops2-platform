"""Lógica de emparejamiento: ¿esta oportunidad le sirve a este perfil?"""
from __future__ import annotations

import unicodedata
from datetime import datetime, timezone

from app.models.opportunity import Opportunity
from app.models.search_profile import SearchProfile


def _normaliza_texto(texto: str | None) -> str:
    if not texto:
        return ""
    # Quita tildes y pasa a minúsculas para comparar sin acentos
    nfkd = unicodedata.normalize("NFKD", texto)
    sin_tildes = "".join(c for c in nfkd if not unicodedata.combining(c))
    return sin_tildes.lower()


def _clases(codigos: list[str] | None) -> set[str]:
    """Clases UNSPSC (primeros 6 dígitos) de una lista de códigos.

    Se empareja por clase, no por código exacto de 8 dígitos: las entidades
    clasifican de forma irregular. Pero NO por familia (4 dígitos): familias
    como 8011 (servicios) son enormes y mezclan rubros muy distintos.
    """
    return {str(c)[:6] for c in (codigos or []) if c and len(str(c)) >= 6}


def coincide(opp: Opportunity, profile: SearchProfile) -> bool:
    """True si la oportunidad cumple los criterios del perfil de búsqueda.

    Inclusión por OR de señales (probado con datos reales: el UNSPSC de SECOP es
    demasiado inconsistente para usarlo como filtro duro — el mismo servicio cae
    en muchas clases y muchos procesos vienen sin código). Por eso:
      - basta que coincida UNA señal declarada: palabra clave en el objeto, o
        clase UNSPSC (6 dígitos). Maximiza recall; las exclusiones podan el ruido.
    Si el perfil no declara ninguna señal, solo aplican geografía y presupuesto.
    """
    if not profile.active:
        return False

    # Alcance geográfico (cada uno filtra solo si el perfil lo especifica).
    if profile.departamento:
        if _normaliza_texto(profile.departamento) not in _normaliza_texto(opp.departamento):
            return False
    if profile.ciudad:
        if _normaliza_texto(profile.ciudad) not in _normaliza_texto(opp.ciudad):
            return False

    # Presupuesto
    if opp.valor is not None:
        if profile.presupuesto_min is not None and opp.valor < float(profile.presupuesto_min):
            return False
        if profile.presupuesto_max is not None and opp.valor > float(profile.presupuesto_max):
            return False

    texto = _normaliza_texto(" ".join(filter(None, [opp.objeto, opp.entidad, opp.estado_secop])))

    # Inclusión por OR de las señales declaradas (UNSPSC clase y/o palabras clave).
    senales: list[bool] = []
    if profile.unspsc_codes:
        senales.append(bool(_clases(profile.unspsc_codes) & _clases(opp.unspsc_codes)))
    if profile.keywords:
        senales.append(any(_normaliza_texto(kw) in texto for kw in profile.keywords))
    if senales and not any(senales):
        return False

    # Exclusiones: si aparece cualquier palabra vetada, se descarta.
    if profile.exclude_keywords:
        if any(_normaliza_texto(kw) in texto for kw in profile.exclude_keywords if kw):
            return False

    return True


def esta_vigente(opp: Opportunity, ahora: datetime | None = None) -> bool:
    """True si todavía se puede ofertar (la fecha de recepción no ha pasado).

    El estado del procedimiento ("Abierto"/"Publicado") no basta: algunos siguen
    marcados como abiertos pero su fecha de recepción de ofertas ya venció. Si la
    oportunidad no trae fecha de cierre, no la descartamos (mejor avisar de más).
    """
    if opp.fecha_cierre is None:
        return True
    ahora = ahora or datetime.now(timezone.utc)
    cierre = opp.fecha_cierre
    if cierre.tzinfo is None:
        cierre = cierre.replace(tzinfo=timezone.utc)
    return cierre >= ahora


def perfiles_que_coinciden(opp: Opportunity, profiles: list[SearchProfile]) -> list[SearchProfile]:
    return [p for p in profiles if coincide(opp, p)]
