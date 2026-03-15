from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    MONGO_URI: str
    DATABASE_NAME: str
    TMDB_API_KEY: str | None = None
    TMDB_USE_MONGO_ONLY: bool = False
    TMDB_TIMEOUT_SECONDS: int = 3
    TMDB_MAX_RETRIES: int = 1
    TMDB_RETRY_BASE_DELAY_SECONDS: float = 0.25

    SQLALCHEMY_DATABASE_URI: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/cinisphere"
    JWT_SECRET_KEY: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    SOCIAL_SEED_ENABLED: bool = False
    SOCIAL_HIDE_SEED_USERS: bool = True
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 60 * 24
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")


settings = Settings()
