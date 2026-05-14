from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://forge:forge@localhost:5432/forge"
    database_url_sync: str = "postgresql://forge:forge@localhost:5432/forge"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
upstash_redis_rest_url: str = ""
upstash_redis_rest_token: str = ""

    # Model APIs
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""

    # Sandbox
    e2b_api_key: str = ""

    # Search
    tavily_api_key: str = ""

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080

    # Observability
    otel_exporter_otlp_endpoint: str = ""
    otel_service_name: str = "forge-backend"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
