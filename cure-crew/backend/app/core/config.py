"""App configuration. Sab secrets .env se aate hain  kabhi hardcode mat karo."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Cure Crew — Case Taking Agent"
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

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
