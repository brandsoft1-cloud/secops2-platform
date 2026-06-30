"""Rastreador de SECOP II (worker en segundo plano).

Por cada pasada:
  1. Trae procesos recientes desde SECOP.
  2. Guarda los que no existían (detección de nuevos).
  3. Empareja cada oportunidad con los perfiles de búsqueda de las empresas.
  4. Crea una Postulacion (estado NUEVA) por cada coincidencia y junta las
     oportunidades nuevas por empresa para alertar por correo.

Uso:
    python -m worker.rastreador           # una pasada y termina
    python -m worker.rastreador --loop    # bucle cada SECOP_POLL_SECONDS
"""
from __future__ import annotations

import argparse
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.company import Company
from app.models.opportunity import Opportunity
from app.models.postulacion import Postulacion
from app.models.search_profile import SearchProfile
from app.services import secop
from app.services.matching import coincide, esta_vigente
from app.services.notificaciones import alertar_oportunidades, alertar_telegram

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("rastreador")


def _guardar_oportunidad(db: Session, datos: dict) -> tuple[Opportunity, bool]:
    """Devuelve (oportunidad, es_nueva)."""
    existente = db.scalar(select(Opportunity).where(Opportunity.secop_id == datos["secop_id"]))
    if existente:
        return existente, False
    opp = Opportunity(**datos)
    db.add(opp)
    db.flush()
    return opp, True


def _consultas_geograficas(perfiles: list[SearchProfile]) -> list[dict[str, str | None]]:
    """Consultas a SECOP según el alcance de cada perfil activo.

    Cada perfil define su alcance: por departamento (todo el depto.) o por
    ciudad. Consultar dirigido es lo que hace útil al radar: el nicho de una pyme
    casi nunca cae en los N procesos más recientes a nivel nacional. Se deduplican
    las consultas; si un perfil no fija ni depto. ni ciudad, se hace una global.
    """
    specs: set[tuple[str | None, str | None]] = set()
    for p in perfiles:
        if p.departamento:
            specs.add((p.departamento, None))   # depto. completo
        elif p.ciudad:
            specs.add((None, p.ciudad))
        else:
            specs.add((None, None))             # global
    return [{"departamento": d, "ciudad": c} for d, c in sorted(specs, key=lambda s: (s[0] or "", s[1] or ""))]


def ejecutar_pasada(limit: int | None = 1000, company_id: int | None = None) -> int:
    """Corre una búsqueda y devuelve cuántas oportunidades NUEVAS se encontraron.

    Si se pasa company_id, busca solo para los perfiles de esa empresa (lo usa el
    botón "Buscar ahora"); si no, para todas (lo usa el rastreador en bucle).
    """
    db = SessionLocal()
    try:
        stmt = select(SearchProfile).where(SearchProfile.active.is_(True))
        if company_id is not None:
            stmt = stmt.where(SearchProfile.company_id == company_id)
        perfiles = db.scalars(stmt).all()
        if not perfiles:
            logger.info("No hay perfiles de búsqueda activos; nada que emparejar.")
            # Aun sin perfiles, deja registro de que se intentó buscar.
            _marcar_busqueda(db, {company_id} if company_id is not None else set())
            db.commit()
            return 0
        # company_id -> lista de oportunidades nuevas que le coinciden
        nuevas_por_empresa: dict[int, list[Opportunity]] = defaultdict(list)
        # (company_id, opportunity_id) ya emparejados en esta pasada. SECOP trae
        # varias filas por proceso (lotes/fases), así que la misma oportunidad
        # puede repetirse; las postulaciones pendientes aún no están en la BD.
        vistas: set[tuple[int, int]] = set()

        total = 0
        for consulta in _consultas_geograficas(perfiles):
            for datos in secop.fetch_procesos(
                ciudad=consulta["ciudad"],
                departamento=consulta["departamento"],
                estados=settings.secop_estados_abiertos,
                desde_dias=settings.secop_dias_recientes,
                limit=limit,
            ):
                total += 1
                opp, es_nueva = _guardar_oportunidad(db, datos)

                if not esta_vigente(opp):
                    continue
                for perfil in perfiles:
                    if not coincide(opp, perfil):
                        continue
                    clave = (perfil.company_id, opp.id)
                    if clave in vistas:
                        continue
                    vistas.add(clave)
                    # ¿Ya existe postulación de esta empresa para esta oportunidad?
                    ya_existe = db.scalar(
                        select(Postulacion).where(
                            Postulacion.company_id == perfil.company_id,
                            Postulacion.opportunity_id == opp.id,
                        )
                    )
                    if ya_existe:
                        continue
                    db.add(Postulacion(company_id=perfil.company_id, opportunity_id=opp.id))
                    nuevas_por_empresa[perfil.company_id].append(opp)

        # Marca cuándo se buscó por última vez para cada empresa consultada.
        _marcar_busqueda(db, {p.company_id for p in perfiles})
        db.commit()
        logger.info("Procesados %d procesos de SECOP (estados abiertos).", total)

        # Alertas por correo
        for cid, oportunidades in nuevas_por_empresa.items():
            company = db.get(Company, cid)
            if not company or not company.users:
                continue
            destinatario = company.users[0].email
            alertar_oportunidades(destinatario, company.name, oportunidades)
            if company.telegram_chat_id:
                alertar_telegram(company.telegram_chat_id, company.name, oportunidades)
            logger.info("Alertadas %d oportunidades a %s", len(oportunidades), company.name)

        return sum(len(v) for v in nuevas_por_empresa.values())

    except Exception:
        db.rollback()
        logger.exception("Error en la pasada del rastreador")
        raise
    finally:
        db.close()


def _marcar_busqueda(db: Session, company_ids: set[int]) -> None:
    ahora = datetime.now(timezone.utc)
    for cid in company_ids:
        company = db.get(Company, cid)
        if company:
            company.last_searched_at = ahora


def main() -> None:
    parser = argparse.ArgumentParser(description="Rastreador de SECOP II")
    parser.add_argument("--loop", action="store_true", help="Correr en bucle continuo")
    parser.add_argument("--limit", type=int, default=1000, help="Máx. procesos por pasada")
    args = parser.parse_args()

    # El esquema lo prepara Alembic (`alembic upgrade head`) antes de correr el worker.
    if args.loop:
        logger.info("Rastreador en bucle cada %d s. Ctrl+C para salir.", settings.secop_poll_seconds)
        while True:
            ejecutar_pasada(limit=args.limit)
            _refrescar_espejo()
            time.sleep(settings.secop_poll_seconds)
    else:
        ejecutar_pasada(limit=args.limit)
        _refrescar_espejo()


def _refrescar_espejo() -> None:
    """Actualiza el espejo local para las zonas con perfiles activos."""
    from app.services import mirror

    db = SessionLocal()
    try:
        res = mirror.refrescar_global(db, dias=settings.secop_dias_recientes)
        logger.info("Espejo refrescado: %s", res)
    except Exception:
        logger.exception("Error refrescando el espejo")
    finally:
        db.close()


if __name__ == "__main__":
    main()
