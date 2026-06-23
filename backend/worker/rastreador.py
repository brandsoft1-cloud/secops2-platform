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
from app.services.notificaciones import alertar_oportunidades

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


def _consultas_por_ciudad(perfiles: list[SearchProfile]) -> list[str | None]:
    """Ciudades a consultar en SECOP según los perfiles activos.

    Consultar dirigido por ciudad es lo que hace útil al radar: el nicho de una
    pyme casi nunca cae en los N procesos más recientes a nivel nacional. Si
    algún perfil no fija ciudad, se añade una consulta global (None).
    """
    ciudades = {p.ciudad for p in perfiles if p.ciudad}
    consultas: list[str | None] = sorted(ciudades)
    if any(not p.ciudad for p in perfiles):
        consultas.append(None)
    return consultas


def ejecutar_pasada(limit: int | None = 1000) -> None:
    db = SessionLocal()
    try:
        perfiles = db.scalars(select(SearchProfile).where(SearchProfile.active.is_(True))).all()
        if not perfiles:
            logger.info("No hay perfiles de búsqueda activos; nada que emparejar.")
            return
        # company_id -> lista de oportunidades nuevas que le coinciden
        nuevas_por_empresa: dict[int, list[Opportunity]] = defaultdict(list)

        total = 0
        for ciudad in _consultas_por_ciudad(perfiles):
            for datos in secop.fetch_procesos(
                ciudad=ciudad,
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

        db.commit()
        logger.info("Procesados %d procesos de SECOP (estados abiertos).", total)

        # Alertas por correo
        for company_id, oportunidades in nuevas_por_empresa.items():
            company = db.get(Company, company_id)
            if not company or not company.users:
                continue
            destinatario = company.users[0].email
            alertar_oportunidades(destinatario, company.name, oportunidades)
            logger.info("Alertadas %d oportunidades a %s", len(oportunidades), company.name)

    except Exception:
        db.rollback()
        logger.exception("Error en la pasada del rastreador")
        raise
    finally:
        db.close()


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
            time.sleep(settings.secop_poll_seconds)
    else:
        ejecutar_pasada(limit=args.limit)


if __name__ == "__main__":
    main()
