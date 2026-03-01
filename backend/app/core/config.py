from pydantic import BaseSettings


class Settings(BaseSettings):
    MONGO_URI: str
    DATABASE_NAME: str

    class Config:
        env_file = ".env"


settings = Settings()