"""Modelos ORM. Importar aquí todos para que Base.metadata los conozca."""
from app.models.company import Company, Plan
from app.models.user import User
from app.models.search_profile import SearchProfile
from app.models.opportunity import Opportunity
from app.models.postulacion import Postulacion, EstadoPostulacion

__all__ = [
    "Company",
    "Plan",
    "User",
    "SearchProfile",
    "Opportunity",
    "Postulacion",
    "EstadoPostulacion",
]
