"""Registro, login y datos del usuario actual."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.company import Company
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest, Token, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> Token:
    existe = db.scalar(select(User).where(User.email == data.email))
    if existe:
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")

    company = Company(name=data.company_name, nit=data.nit)
    db.add(company)
    db.flush()  # para obtener company.id

    # Quien registra la empresa es su administrador.
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.ADMIN,
        company_id=company.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return Token(access_token=create_access_token(user.id))


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    # OAuth2PasswordRequestForm usa "username"; aquí es el email.
    user = db.scalar(select(User).where(User.email == form.username))
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> User:
    return current


@router.get("/plan")
def plan(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Plan vigente, límites y consumo (para mostrar topes y avisos de upgrade)."""
    from app import plans

    return plans.estado_plan(db.get(Company, current.company_id), db)
