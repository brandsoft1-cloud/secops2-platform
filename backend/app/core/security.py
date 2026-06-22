"""Hash de contraseñas y emisión/validación de JWT."""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt, JWTError

from app.config import settings


def _encode(password: str) -> bytes:
    # bcrypt sólo admite hasta 72 bytes; se truncan de forma explícita.
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_encode(plain), hashed.encode("utf-8"))


def create_access_token(subject: str | int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    """Devuelve el `sub` (id de usuario) o None si el token es inválido."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None
