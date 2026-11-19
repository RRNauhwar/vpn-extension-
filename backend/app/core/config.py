from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "GlobeVPN"
    app_env: str = "development"
    app_debug: bool = False
    api_v1_prefix: str = "/api"

    # Security
    jwt_secret_key: str = "dev-only-insecure-secret-change-in-production-64bytes"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14
    admin_api_key: str = "dev-only-admin-key-change-in-production"

    # Database & Redis
    database_url: str = "sqlite:///./globevpn_dev.db"
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    cors_origins: str = "chrome-extension://*,http://localhost:5173,http://localhost:8000"

    # Free-tier & Pro-tier limits
    free_tier_max_session_minutes: int = 120
    free_tier_max_daily_sessions: int = 20
    free_tier_rate_limit_per_minute: int = 60
    pro_tier_max_session_minutes: int = 1440
    pro_tier_rate_limit_per_minute: int = 240
    proxy_session_ttl_seconds: int = 7200

    # Health check settings
    health_check_interval_seconds: int = 30
    health_check_timeout_seconds: float = 5.0

    # Optional local Docker proxy node (ONLY registered when explicitly enabled)
    local_proxy_enabled: bool = False
    local_proxy_host: str = "127.0.0.1"
    local_proxy_port: int = 8443
    local_proxy_scheme: str = "http"
    local_proxy_auth_user: str = "globevpn_local"
    local_proxy_auth_pass: str = "globevpn_local_pass"
    local_proxy_country_code: str = "LOCAL"
    local_proxy_country_name: str = "Local Docker Node"
    local_proxy_city: str = "Localhost"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
