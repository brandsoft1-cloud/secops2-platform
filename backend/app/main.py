"""Punto de entrada de la API FastAPI."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import auth, documentos, health, opportunities, profiles


# El esquema de la base de datos se gestiona con migraciones Alembic.
# Antes de arrancar la app corre: `alembic upgrade head`.
app = FastAPI(
    title="Radar de Licitaciones API",
    description="Vigila SECOP II y avisa a las pymes qué procesos públicos pueden ganar.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(opportunities.router)
app.include_router(documentos.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"servicio": "Radar de Licitaciones", "docs": "/docs"}
