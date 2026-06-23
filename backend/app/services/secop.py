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


def fetch_procesos(
    *,
    ciudad: str | None = None,
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
