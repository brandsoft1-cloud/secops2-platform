"""Schemas de oportunidades, perfiles de búsqueda y postulaciones (CRM)."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.postulacion import EstadoPostulacion


# --- Perfil de búsqueda ---
class SearchProfileBase(BaseModel):
    name: str = "Mi búsqueda"
    sector: str | None = None
    # Códigos UNSPSC del proponente (de su RUP). Señal primaria de matching.
    unspsc_codes: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    exclude_keywords: list[str] = Field(default_factory=list)
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
    unspsc_codes: list[str] = Field(default_factory=list)
    fecha_publicacion: datetime | None
    fecha_cierre: datetime | None
    url: str | None

    model_config = {"from_attributes": True}


class SeguirRequest(BaseModel):
    secop_id: str


# Proceso del explorador (viene directo de SECOP, sin estado/CRM ni id propio).
class ExploreOut(BaseModel):
    secop_id: str
    entidad: str | None = None
    objeto: str | None = None
    valor: float | None = None
    ciudad: str | None = None
    departamento: str | None = None
    estado_secop: str | None = None
    modalidad: str | None = None
    tipo_contrato: str | None = None
    unspsc_codes: list[str] = Field(default_factory=list)
    fecha_publicacion: datetime | None = None
    fecha_cierre: datetime | None = None
    url: str | None = None


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
class AssigneeOut(BaseModel):
    id: int
    full_name: str | None
    email: str

    model_config = {"from_attributes": True}


class PostulacionUpdate(BaseModel):
    estado: EstadoPostulacion | None = None
    notas: str | None = None
    assignee_id: int | None = None
    # Distingue "no tocar" (campo ausente) de "quitar responsable" (null explícito).
    set_assignee: bool = False


class PostulacionOut(BaseModel):
    id: int
    estado: EstadoPostulacion
    notas: str | None
    updated_at: datetime
    assignee: AssigneeOut | None = None
    # Análisis de IA (None hasta que se solicita).
    ia_resumen: str | None = None
    ia_afinidad: int | None = None
    ia_motivo: str | None = None
    ia_checklist: list[str] | None = None
    ia_carta: str | None = None
    opportunity: OpportunityOut

    model_config = {"from_attributes": True}
