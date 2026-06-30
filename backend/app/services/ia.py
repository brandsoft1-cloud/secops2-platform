"""Análisis con IA (vía OpenRouter, API compatible con OpenAI).

Dos usos, ambos a demanda (no en cada búsqueda, para acotar costo/latencia):
  1. Resumir una oportunidad en lenguaje llano y puntuar su afinidad 0-100
     con el perfil de la empresa, con una justificación corta.
  2. Generar un checklist de requisitos y un borrador de carta de presentación.

OpenRouter expone muchos modelos (Claude, GPT, modelos abiertos…) con una sola
key. El modelo se elige con OPENROUTER_MODEL. Si no hay OPENROUTER_API_KEY, las
funciones devuelven None y la app sigue funcionando sin IA (degradación con
gracia, igual que SMTP/Telegram).
"""
from __future__ import annotations

import logging

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, Field, ValidationError

from app.config import settings
from app.models.opportunity import Opportunity
from app.models.search_profile import SearchProfile

logger = logging.getLogger("ia")


# --- Formas de salida ---
class AnalisisAfinidad(BaseModel):
    resumen: str = Field(description="Resumen en 2-3 frases del objeto del proceso, en lenguaje llano.")
    afinidad: int = Field(ge=0, le=100, description="Qué tan bien encaja con el perfil (0-100).")
    motivo: str = Field(description="Una frase explicando el puntaje de afinidad.")


class Asistente(BaseModel):
    checklist: list[str] = Field(description="Requisitos y documentos a preparar para postularse.")
    carta: str = Field(description="Borrador de carta de presentación dirigido a la entidad.")


# Esquemas JSON para structured outputs (modo estricto: todo requerido,
# additionalProperties=false). Se escriben a mano para máxima compatibilidad
# entre modelos de OpenRouter.
_SCHEMA_AFINIDAD = {
    "type": "object",
    "properties": {
        "resumen": {"type": "string"},
        "afinidad": {"type": "integer"},
        "motivo": {"type": "string"},
    },
    "required": ["resumen", "afinidad", "motivo"],
    "additionalProperties": False,
}
_SCHEMA_ASISTENTE = {
    "type": "object",
    "properties": {
        "checklist": {"type": "array", "items": {"type": "string"}},
        "carta": {"type": "string"},
    },
    "required": ["checklist", "carta"],
    "additionalProperties": False,
}


def _client() -> OpenAI | None:
    if not settings.openrouter_api_key:
        return None
    return OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        default_headers={"X-Title": settings.openrouter_app_name},
    )


def _completar(prompt: str, nombre_esquema: str, esquema: dict, max_tokens: int) -> str | None:
    """Llama al modelo pidiendo salida JSON estricta; devuelve el texto JSON o None."""
    client = _client()
    if client is None:
        logger.info("[IA no configurada] llamada a OpenRouter omitida (%s)", nombre_esquema)
        return None
    try:
        resp = client.chat.completions.create(
            model=settings.openrouter_model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": nombre_esquema, "strict": True, "schema": esquema},
            },
        )
        return resp.choices[0].message.content
    except OpenAIError:
        logger.exception("Error llamando a OpenRouter (%s)", nombre_esquema)
        return None


def _describe_opp(opp: Opportunity) -> str:
    valor = f"${opp.valor:,.0f}" if opp.valor else "sin valor publicado"
    return (
        f"Entidad: {opp.entidad or '—'}\n"
        f"Objeto: {opp.objeto or '—'}\n"
        f"Valor: {valor}\n"
        f"Lugar: {opp.ciudad or '—'}, {opp.departamento or '—'}\n"
        f"Modalidad: {opp.modalidad or '—'}\n"
        f"Tipo de contrato: {opp.tipo_contrato or '—'}\n"
        f"Estado: {opp.estado_secop or '—'}"
    )


def _describe_perfil(perfil: SearchProfile | None) -> str:
    if perfil is None:
        return "La empresa no tiene un perfil de búsqueda específico."
    partes = [f"Sector: {perfil.sector or '—'}"]
    if perfil.keywords:
        partes.append("Palabras clave: " + ", ".join(perfil.keywords))
    if perfil.exclude_keywords:
        partes.append("Evita: " + ", ".join(perfil.exclude_keywords))
    if perfil.departamento or perfil.ciudad:
        partes.append(f"Zona: {perfil.ciudad or ''} {perfil.departamento or ''}".strip())
    return "\n".join(partes)


def analizar_afinidad(opp: Opportunity, perfil: SearchProfile | None) -> AnalisisAfinidad | None:
    """Resume la oportunidad y puntúa su encaje con el perfil de la empresa."""
    prompt = (
        "Eres un asesor de licitaciones públicas en Colombia (SECOP II) para pymes.\n"
        "Analiza esta oportunidad frente al perfil de la empresa y responde solo con el JSON pedido.\n\n"
        f"=== OPORTUNIDAD ===\n{_describe_opp(opp)}\n\n"
        f"=== PERFIL DE LA EMPRESA ===\n{_describe_perfil(perfil)}\n\n"
        "Resume el objeto en lenguaje llano (sin tecnicismos del pliego) y puntúa de 0 a 100 "
        "qué tan buena es esta oportunidad para esta empresa, considerando objeto, zona y presupuesto."
    )
    contenido = _completar(prompt, "analisis_afinidad", _SCHEMA_AFINIDAD, max_tokens=1024)
    if contenido is None:
        return None
    try:
        analisis = AnalisisAfinidad.model_validate_json(contenido)
    except ValidationError:
        logger.exception("Respuesta de IA inválida para análisis de la oportunidad %s", opp.id)
        return None
    # El modo estricto no permite límites numéricos; acotamos por las dudas.
    analisis.afinidad = max(0, min(100, analisis.afinidad))
    return analisis


def generar_asistente(opp: Opportunity, empresa: str) -> Asistente | None:
    """Genera un checklist de requisitos y un borrador de carta de presentación."""
    prompt = (
        "Eres un asesor de licitaciones públicas en Colombia (SECOP II) para pymes.\n"
        f"La empresa '{empresa}' quiere postularse a esta oportunidad. Responde solo con el JSON pedido.\n\n"
        f"=== OPORTUNIDAD ===\n{_describe_opp(opp)}\n\n"
        "1) Arma un checklist concreto de requisitos y documentos típicos a preparar para "
        "presentar la oferta (cada ítem corto y accionable).\n"
        "2) Redacta un borrador breve de carta de presentación dirigido a la entidad, "
        "en tono formal y en español, listo para que la empresa lo ajuste."
    )
    contenido = _completar(prompt, "asistente", _SCHEMA_ASISTENTE, max_tokens=4096)
    if contenido is None:
        return None
    try:
        return Asistente.model_validate_json(contenido)
    except ValidationError:
        logger.exception("Respuesta de IA inválida para asistente de la oportunidad %s", opp.id)
        return None
