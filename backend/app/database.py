"""Conexión a la base de datos y sesión de SQLAlchemy."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Clase base para todos los modelos ORM."""


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: entrega una sesión y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Crea las tablas si no existen. Para producción usar migraciones (Alembic)."""
    # Importa los modelos para que queden registrados en Base.metadata
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
