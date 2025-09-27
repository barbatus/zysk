from pydantic import AliasChoices, BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class TemporalSettings(BaseModel):
    url: str
    namespace: str
    api_key: str | None
    tls: bool


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[".env", ".env.local"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_url: str = Field(
        validation_alias=AliasChoices("POSTGRES_URL", "DB_URL"),
    )

    cache_enabled: bool = Field(default=True, alias="CACHE")

    proxy_url: str | None
    proxy_username: str | None
    proxy_pwd: str | None

    cdp_url: str | None

    temporal_url: str
    temporal_namespace: str = "default"
    temporal_api_key: str | None = None
    temporal_tls: bool = False

    redis_url: str | None = None

    @property
    def temporal(self) -> TemporalSettings:
        return TemporalSettings(
            url=self.temporal_url,
            namespace=self.temporal_namespace,
            api_key=self.temporal_api_key,
            tls=self.temporal_tls,
        )

    @property
    def async_db_url(self) -> str:
        return self.db_url.replace("postgresql://", "postgresql+asyncpg://", 1)


settings = Settings()
