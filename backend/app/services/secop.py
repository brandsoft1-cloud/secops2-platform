"""Motor de datos SECOP II.

Cliente de la API abierta de datos.gov.co (Socrata). Trae procesos de
contratación y los normaliza a un dict estándar que el resto del sistema entiende.

Dataset por defecto: "SECOP II - Procesos de Contratación" (p6dx-8zbt).
Los nombres de columnas pueden variar entre datasets; ajusta `_normalizar`
si cambias de fuente.
"""
from __future__ import annotations

from datetime import datetime
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


def fetch_procesos(
    *,
    ciudad: str | None = None,
    estado: str | None = None,
    limit: int | None = None,
) -> Iterator[dict[str, Any]]:
    """Genera procesos normalizados desde SECOP, paginando con $limit/$offset.

    Filtra del lado del servidor por ciudad/estado cuando se indica, para no
    descargar de más. El emparejamiento fino (keywords, presupuesto) lo hace
    `matching.py` sobre el resultado.
    """
    page_size = settings.secop_page_size
    headers = {}
    if settings.secop_app_token:
        headers["X-App-Token"] = settings.secop_app_token

    where_clauses = []
    if ciudad:
        where_clauses.append(f"upper(ciudad_entidad) like upper('%{ciudad}%')")
    if estado:
        where_clauses.append(f"upper(estado_del_procedimiento) = upper('{estado}')")

    offset = 0
    descargados = 0
    with httpx.Client(timeout=30) as client:
        while True:
            params: dict[str, Any] = {"$limit": page_size, "$offset": offset, "$order": "fecha_de_publicacion_del DESC"}
            if where_clauses:
                params["$where"] = " AND ".join(where_clauses)

            resp = client.get(settings.secop_dataset_url, params=params, headers=headers)
            resp.raise_for_status()
            rows = resp.json()
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
