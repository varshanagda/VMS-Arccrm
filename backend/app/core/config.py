from pydantic import Field
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import quote_plus


class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = None
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "arc_crm"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    JWT_SECRET_KEY: str = "change_this_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24
    INIT_DB_ON_STARTUP: bool = False
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://192.168.126.197:3000",
            "http://visitor.arcgate.in:3000",
        ]
    )
    CORS_ORIGIN_REGEX: str = r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|.*\.arcgate\.in)(:\d+)?$"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    APP_BASE_URL: Optional[str] = None
    FRONTEND_BASE_URL: Optional[str] = None
    THIRD_PARTY_API_DOMAIN: Optional[str] = None
    ARCCRM_API_URL: Optional[str] = None
    APP_ID: Optional[str] = None
    RECEPTION_EMAIL: Optional[str] = None
    BUSINESS_TIMEZONE: str = "Asia/Kolkata"

    # Missing fields from .env
    EMPLOYEE_API_URL: Optional[str] = None
    EMPLOYEE_APP_ID: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        encoded_user = quote_plus(self.DB_USER)
        encoded_password = quote_plus(self.DB_PASSWORD)
        auth = f"{encoded_user}:{encoded_password}" if self.DB_PASSWORD else encoded_user
        return (
            f"postgresql+psycopg://{auth}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()
