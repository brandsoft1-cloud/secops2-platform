"""Schemas de oportunidades, perfiles de búsqueda y postulaciones (CRM)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.postulacion import EstadoPostulacion


# --- Perfil de búsqueda ---
class SearchProfileBase(BaseModel):
    name: str = "Mi búsqueda"
    sector: str | None = None
    keywords: list[str] = Field(default_factory=list)
    ciudad: str | None = None
    departamento: str | None = None
    presupuesto_min: Decimal | None = None
    presupuesto_max: Decimal | None = None
    active: bool = True


class SearchProfileCreate(SearchProfileBase):
    pass


class SearchProfileOut(SearchProfileBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Oportunidad ---
class OpportunityOut(BaseModel):
    id: int
    secop_id: str
    entidad: str | None
    objeto: str | None
    valor: Decimal | None
    ciudad: str | None
    departamento: str | None
    estado_secop: str | None
    modalidad: str | None
    tipo_contrato: str | None
    fecha_publicacion: datetime | None
    fecha_cierre: datetime | None
    url: str | None

    model_config = {"from_attributes": True}


# --- Documentos ---
class DocumentoOut(BaseModel):
    id: int
    nombre: str
    content_type: str | None
    tamano: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Resultado de "Buscar ahora" ---
class BuscarResult(BaseModel):
    nuevas: int
    last_searched_at: datetime | None = None


# --- Postulacion (CRM) ---
class PostulacionUpdate(BaseModel):
    estado: EstadoPostulacion | None = None
    notas: str | None = None


class PostulacionOut(BaseModel):
    id: int
    estado: EstadoPostulacion
    notas: str | None
    updated_at: datetime
    opportunity: OpportunityOut

    model_config = {"from_attributes": True}
