"""Perfiles de búsqueda de la empresa (sector, keywords, ciudad, presupuesto)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import plans
from app.api.deps import get_current_user
from app.database import get_db
from app.models.company import Company
from app.models.search_profile import SearchProfile
from app.models.user import User
from app.schemas.opportunity import SearchProfileCreate, SearchProfileOut

router = APIRouter(prefix="/api/profiles", tags=["perfiles de búsqueda"])


@router.get("", response_model=list[SearchProfileOut])
def listar(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(SearchProfile).where(SearchProfile.company_id == current.company_id)
    ).all()


@router.post("", response_model=SearchProfileOut, status_code=status.HTTP_201_CREATED)
def crear(
    data: SearchProfileCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plans.exigir_cupo_perfil(db.get(Company, current.company_id), db)
    profile = SearchProfile(**data.model_dump(), company_id=current.company_id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=SearchProfileOut)
def actualizar(
    profile_id: int,
    data: SearchProfileCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.get(SearchProfile, profile_id)
    if not profile or profile.company_id != current.company_id:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    for campo, valor in data.model_dump().items():
        setattr(profile, campo, valor)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    profile_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.get(SearchProfile, profile_id)
    if not profile or profile.company_id != current.company_id:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    db.delete(profile)
    db.commit()
