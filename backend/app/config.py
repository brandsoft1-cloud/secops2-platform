"""Configuración central leída de variables de entorno (.env)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base de datos
    database_url: str = "postgresql+psycopg://licitaciones:licitaciones@localhost:5432/licitaciones"

    # Seguridad / JWT
    secret_key: str = "cambia-esto"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 días
    algorithm: str = "HS256"

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # Almacenamiento de documentos. Local por ahora; luego S3/R2.
    storage_dir: str = "storage"
    max_upload_mb: int = 20

    # SECOP II
    secop_dataset_url: str = "https://www.datos.gov.co/resource/p6dx-8zbt.json"
    secop_app_token: str = ""
    secop_poll_seconds: int = 3600
    secop_page_size: int = 500
    # Estados del procedimiento en los que una pyme todavía puede ofertar.
    # El dataset también trae "Seleccionado"/"Evaluación"/"Cancelado" (ya cerrados),
    # que NO deben generar alertas.
    secop_estados_abiertos: list[str] = ["Abierto", "Publicado"]
    # Ventana de recencia: solo procesos publicados en los últimos N días.
    # Acota el volumen (evita paginación profunda) y define qué es "nuevo".
    secop_dias_recientes: int = 30

    # Correo (SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Radar de Licitaciones <alertas@example.com>"

    # WhatsApp (Fase 2)
    whatsapp_api_url: str = ""
    whatsapp_api_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
