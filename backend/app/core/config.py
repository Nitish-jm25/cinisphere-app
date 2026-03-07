from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    MONGO_URI: str
    DATABASE_NAME: str
    TMDB_API_KEY: str | None = None
    TMDB_TIMEOUT_SECONDS: int = 15
    TMDB_MAX_RETRIES: int = 3
    TMDB_RETRY_BASE_DELAY_SECONDS: float = 0.5

    SQLALCHEMY_DATABASE_URI: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/cinisphere"
    JWT_SECRET_KEY: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")


settings = Settings()
