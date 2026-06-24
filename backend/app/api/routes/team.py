"""Gestión de equipo: los administradores crean/eliminan usuarios de su empresa."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.security import hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.auth import TeamMemberCreate, TeamMemberOut

router = APIRouter(prefix="/api/team", tags=["equipo"])


@router.get("", response_model=list[TeamMemberOut])
def listar(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Todos los usuarios de la empresa (cualquier miembro puede verlos)."""
    return db.scalars(
        select(User).where(User.company_id == current.company_id).order_by(User.id)
    ).all()


@router.post("", response_model=TeamMemberOut, status_code=status.HTTP_201_CREATED)
def crear(
    data: TeamMemberCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """El admin crea un usuario de su empresa con una contraseña inicial."""
    if db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        company_id=admin.company_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    user = db.get(User, user_id)
    if not user or user.company_id != admin.company_id:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()
