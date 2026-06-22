"""Punto de entrada de la API FastAPI."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api.routes import auth, health, opportunities, profiles


@asynccontextmanager
async def lifespan(app: FastAPI):
    # En desarrollo crea las tablas al arrancar. En producción usar Alembic.
    init_db()
    yield


app = FastAPI(
    title="Radar de Licitaciones API",
    description="Vigila SECOP II y avisa a las pymes qué procesos públicos pueden ganar.",
    version="0.1.0",
    lifespan=lifespan,
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


@app.get("/")
def root() -> dict[str, str]:
    return {"servicio": "Radar de Licitaciones", "docs": "/docs"}
