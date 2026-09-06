"""App configuration. Sab secrets .env se aate hain  kabhi hardcode mat karo."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Care Crew — Case Taking Agent"
    DEBUG: bool = True

    # Infra
    REDIS_URL: str = "redis://localhost:6379/0"
    DATABASE_URL: str = "postgresql://localhost:5432/curecrew"

    # LLM keys — .env se
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    SARVAM_API_KEY: str = ""

    # Session
    SESSION_TTL_SECONDS: int = 3600

    # Auth — prescription module. Override JWT_SECRET_KEY in .env for anything
    # beyond local dev.
    JWT_SECRET_KEY: str = "dev-secret-change-me-in-.env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # File uploads — prescription module
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # CORS — comma-separated origins, or "*" for all. Set to the deployed
    # frontend URL in production; "*" is fine for local dev / a Bearer-token
    # API (no cookies involved).
    CORS_ALLOWED_ORIGINS: str = "*"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
