"""Motor de datos SECOP II.

Cliente de la API abierta de datos.gov.co (Socrata). Trae procesos de
contratación y los normaliza a un dict estándar que el resto del sistema entiende.

Dataset por defecto: "SECOP II - Procesos de Contratación" (p6dx-8zbt).
Los nombres de columnas pueden variar entre datasets; ajusta `_normalizar`
si cambias de fuente.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import httpx

from app.config import settings


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        # Socrata entrega ISO 8601, p.ej. "2026-01-15T00:00:00.000"
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _unspsc_codes(row: dict[str, Any]) -> list[str]:
    """Extrae los códigos UNSPSC de un proceso.

    SECOP los entrega como 'codigo_principal_de_categoria' = 'V1.80111500' y
    'categorias_adicionales' = 'V172101500, V172103300' (con coma; ahí el prefijo
    es 'V1' sin punto). Normalizamos a los 8 dígitos UNSPSC, sin duplicados.
    """
    crudos: list[str] = []
    principal = row.get("codigo_principal_de_categoria")
    if principal:
        crudos.append(str(principal))
    adicionales = row.get("categorias_adicionales")
    if adicionales and str(adicionales).lower() != "no definido":
        crudos.extend(str(adicionales).split(","))

    codigos: list[str] = []
    for token in crudos:
        t = token.strip().upper()
        # Quita el prefijo de versión: 'V1.80111500' o 'V172101500' -> '80111500'.
        if t.startswith("V1."):
            t = t[3:]
        elif t.startswith("V1"):
            t = t[2:]
        elif t.startswith("V"):
            t = t[1:]
        digitos = "".join(c for c in t if c.isdigit())
        if 6 <= len(digitos) <= 8 and digitos not in codigos:
            codigos.append(digitos)
    return codigos


def _normalizar(row: dict[str, Any]) -> dict[str, Any]:
    """Mapea una fila cruda de SECOP a nuestro formato interno."""
    return {
        "secop_id": (
            row.get("id_del_proceso")
            or row.get("referencia_del_proceso")
            or row.get("id_del_portafolio")
            or ""
        ),
        "entidad": row.get("entidad") or row.get("nombre_entidad"),
        "objeto": row.get("descripci_n_del_procedimiento") or row.get("objeto_del_contrato"),
        "valor": _to_float(row.get("precio_base") or row.get("valor_total_adjudicacion")),
        "ciudad": row.get("ciudad") or row.get("ciudad_entidad"),
        "departamento": row.get("departamento") or row.get("departamento_entidad"),
        "estado_secop": row.get("estado_del_procedimiento") or row.get("fase"),
        "modalidad": row.get("modalidad_de_contratacion"),
        "tipo_contrato": row.get("tipo_de_contrato"),
        "unspsc_codes": _unspsc_codes(row),
        "fecha_publicacion": _to_dt(row.get("fecha_de_publicacion_del")),
        "fecha_cierre": _to_dt(row.get("fecha_de_recepcion_de") or row.get("fecha_de_cierre")),
        "url": row.get("urlproceso", {}).get("url") if isinstance(row.get("urlproceso"), dict) else row.get("urlproceso"),
        "raw": row,
    }


def _escape(value: str) -> str:
    """Escapa comillas simples para interpolar en cláusulas SoQL ($where)."""
    return value.replace("'", "''")


def _get_con_reintento(client: httpx.Client, params: dict, headers: dict) -> list[dict]:
    """GET a Socrata con un reintento: el dataset es grande y a veces tarda."""
    for intento in range(2):
        try:
            resp = client.get(settings.secop_dataset_url, params=params, headers=headers)
            resp.raise_for_status()
            return resp.json()
        except (httpx.TimeoutException, httpx.TransportError):
            if intento == 1:
                raise
    return []


def _where_abiertos(estados: list[str] | None, desde_dias: int | None) -> list[str]:
    clauses: list[str] = []
    if estados:
        en_lista = ",".join(f"'{_escape(e)}'" for e in estados)
        clauses.append(f"estado_del_procedimiento in ({en_lista})")
    if desde_dias:
        corte = (datetime.now(timezone.utc) - timedelta(days=desde_dias)).strftime("%Y-%m-%dT00:00:00")
        clauses.append(f"fecha_de_publicacion_del >= '{corte}'")
    return clauses


def _headers() -> dict[str, str]:
    return {"X-App-Token": settings.secop_app_token} if settings.secop_app_token else {}


def contar(*, estados: list[str] | None = None, desde_dias: int | None = None) -> int:
    """Total de procesos que cumplen el filtro (para el "Encontrados: N")."""
    params: dict[str, Any] = {"$select": "count(*)"}
    where = _where_abiertos(estados, desde_dias)
    if where:
        params["$where"] = " AND ".join(where)
    with httpx.Client(timeout=60) as client:
        rows = _get_con_reintento(client, params, _headers())
    try:
        return int(rows[0]["count"])
    except (IndexError, KeyError, ValueError):
        return 0


def fetch_uno(secop_id: str) -> dict[str, Any] | None:
    """Trae un proceso puntual por su id (para 'Seguir' desde el explorador)."""
    params: dict[str, Any] = {
        "$where": f"id_del_proceso='{_escape(secop_id)}'",
        "$limit": 1,
    }
    with httpx.Client(timeout=60) as client:
        rows = _get_con_reintento(client, params, _headers())
    if not rows:
        return None
    return _normalizar(rows[0])


def fetch_pagina(
    *,
    offset: int,
    limit: int,
    estados: list[str] | None = None,
    desde_dias: int | None = None,
) -> list[dict[str, Any]]:
    """Una sola página de procesos (para el explorador: scroll de N en N).

    A diferencia de fetch_procesos (que recorre todo), trae exactamente
    [offset, offset+limit) ordenado por publicación reciente. Sirve para
    navegar TODO SECOP II sin filtro de empresa, cargando de a poco.
    """
    headers = {}
    if settings.secop_app_token:
        headers["X-App-Token"] = settings.secop_app_token

    where_clauses = []
    if estados:
        en_lista = ",".join(f"'{_escape(e)}'" for e in estados)
        where_clauses.append(f"estado_del_procedimiento in ({en_lista})")
    if desde_dias:
        corte = (datetime.now(timezone.utc) - timedelta(days=desde_dias)).strftime("%Y-%m-%dT00:00:00")
        where_clauses.append(f"fecha_de_publicacion_del >= '{corte}'")

    params: dict[str, Any] = {"$limit": limit, "$offset": offset, "$order": "fecha_de_publicacion_del DESC"}
    if where_clauses:
        params["$where"] = " AND ".join(where_clauses)

    with httpx.Client(timeout=60) as client:
        rows = _get_con_reintento(client, params, headers)
    return [n for r in rows if (n := _normalizar(r))["secop_id"]]


def fetch_procesos(
    *,
    ciudad: str | None = None,
    departamento: str | None = None,
    estados: list[str] | None = None,
    desde_dias: int | None = None,
    limit: int | None = None,
) -> Iterator[dict[str, Any]]:
    """Genera procesos normalizados desde SECOP, paginando con $limit/$offset.

    Filtra del lado del servidor por ciudad, estados del procedimiento y
    recencia (`desde_dias`) cuando se indica, para no descargar de más: el
    dataset tiene >8M filas (la mayoría ya adjudicadas) y la paginación profunda
    sobre un resultado ordenado se degrada hasta dar timeout. El emparejamiento
    fino (keywords, presupuesto) lo hace `matching.py` sobre el resultado.
    """
    page_size = settings.secop_page_size
    headers = {}
    if settings.secop_app_token:
        headers["X-App-Token"] = settings.secop_app_token

    where_clauses = []
    if ciudad:
        where_clauses.append(f"upper(ciudad_entidad) like upper('%{_escape(ciudad)}%')")
    if departamento:
        where_clauses.append(f"upper(departamento_entidad) like upper('%{_escape(departamento)}%')")
    if estados:
        en_lista = ",".join(f"'{_escape(e)}'" for e in estados)
        where_clauses.append(f"estado_del_procedimiento in ({en_lista})")
    if desde_dias:
        corte = (datetime.now(timezone.utc) - timedelta(days=desde_dias)).strftime("%Y-%m-%dT00:00:00")
        where_clauses.append(f"fecha_de_publicacion_del >= '{corte}'")

    offset = 0
    descargados = 0
    with httpx.Client(timeout=60) as client:
        while True:
            params: dict[str, Any] = {"$limit": page_size, "$offset": offset, "$order": "fecha_de_publicacion_del DESC"}
            if where_clauses:
                params["$where"] = " AND ".join(where_clauses)

            rows = _get_con_reintento(client, params, headers)
            if not rows:
                break

            for row in rows:
                normalizado = _normalizar(row)
                if not normalizado["secop_id"]:
                    continue
                yield normalizado
                descargados += 1
                if limit and descargados >= limit:
                    return

            if len(rows) < page_size:
                break
            offset += page_size
