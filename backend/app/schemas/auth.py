"""Schemas de autenticación y registro."""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.company import Plan
from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    phone: str | None = None
    company_name: str
    nit: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CompanyOut(BaseModel):
    id: int
    name: str
    nit: str | None
    plan: Plan
    trial_ends_at: datetime
    last_searched_at: datetime | None = None
    telegram_chat_id: str | None = None

    model_config = {"from_attributes": True}


class CompanySettingsUpdate(BaseModel):
    # null o "" para desconectar Telegram.
    telegram_chat_id: str | None = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    role: UserRole
    company: CompanyOut

    model_config = {"from_attributes": True}


# --- Gestión de equipo ---
class TeamMemberOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class TeamMemberCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    role: UserRole = UserRole.MIEMBRO
