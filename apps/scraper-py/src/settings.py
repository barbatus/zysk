from pydantic import AliasChoices, BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class TemporalSettings(BaseModel):
    url: str
    namespace: str
    api_key: str | None
    tls: bool


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_url: str = Field(
        validation_alias=AliasChoices("POSTGRES_URL", "DB_URL"),
    )

    cache_enabled: bool = Field(default=True, alias="CACHE")

    proxy_url: str | None = Field(default=None, alias="PROXY_URL")

    temporal_url: str = Field(default="", alias="TEMPORAL_URL")
    temporal_namespace: str = Field(default="default", alias="TEMPORAL_NAMESPACE")
    temporal_api_key: str | None = Field(default=None, alias="TEMPORAL_API_KEY")
    temporal_tls: bool = Field(default=False, alias="TEMPORAL_TLS")

    redis_url: str | None = Field(default=None, alias="REDIS_URL")

    cdp_url: str | None = Field(default=None, alias="CDP_URL")

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
