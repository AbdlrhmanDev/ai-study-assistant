from __future__ import annotations

from functools import lru_cache
from urllib.parse import urlparse

from dotenv import dotenv_values
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The "known insecure defaults" a fresh `.env` ships with, used below to
# detect an unconfigured production deploy. Read from the actual `.env` file
# (falling back to the historical literals when it's absent, e.g. in CI or a
# container with no .env mounted) so these track whatever this checkout's
# `.env` currently defines, instead of duplicating the values as separate
# hardcoded constants that can drift out of sync with it.
_DOTENV_VALUES = dotenv_values(".env")

DEV_DATABASE_URL = _DOTENV_VALUES.get("DATABASE_URL") or (
    "postgres://postgres:postgres@localhost:5432/ai_study_assistant"
)
DEV_CLIENT_ORIGINS = _DOTENV_VALUES.get("CLIENT_ORIGINS") or (
    "http://localhost:3000,http://localhost:3001"
)
DEV_SESSION_SECRET = _DOTENV_VALUES.get("SESSION_SECRET") or "development-only-session-secret"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    node_env: str = Field("development", alias="NODE_ENV")
    port: int = Field(5000, alias="PORT", ge=1, le=65535)

    database_url: str = Field(DEV_DATABASE_URL, alias="DATABASE_URL")
    database_ssl: bool = Field(False, alias="DATABASE_SSL")
    database_pool_max: int = Field(10, alias="DATABASE_POOL_MAX", ge=1)

    session_secret: str = Field(DEV_SESSION_SECRET, alias="SESSION_SECRET")
    client_origins: str = Field(DEV_CLIENT_ORIGINS, alias="CLIENT_ORIGINS")

    log_level_raw: str | None = Field(None, alias="LOG_LEVEL")
    api_rate_limit: int = Field(300, alias="API_RATE_LIMIT", ge=1)
    auth_rate_limit: int = Field(10, alias="AUTH_RATE_LIMIT", ge=1)
    ai_rate_limit: int = Field(30, alias="AI_RATE_LIMIT", ge=1)
    # When set, rate limit counters are stored in Redis so they're shared
    # across replicas instead of each instance counting independently.
    # Falls back to in-process memory (per-instance limits) when empty.
    redis_url: str = Field("", alias="REDIS_URL")

    ai_provider: str = Field("gemini", alias="AI_PROVIDER")
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.5-flash", alias="GEMINI_MODEL")
    groq_api_key: str = Field("", alias="GROQ_API_KEY")
    groq_model: str = Field("llama-3.3-70b-versatile", alias="GROQ_MODEL")
    openai_api_key: str = Field("", alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4.1-mini", alias="OPENAI_MODEL")

    rag_top_k: int = Field(6, alias="RAG_TOP_K", ge=1)
    rag_chunk_size: int = Field(1200, alias="RAG_CHUNK_SIZE", ge=1)
    rag_chunk_overlap: int = Field(180, alias="RAG_CHUNK_OVERLAP", ge=0)

    # Hybrid retrieval: vector search + BM25, fused via Reciprocal Rank Fusion.
    # Independent from AI_PROVIDER since Groq has no embeddings API.
    embedding_provider: str = Field("gemini", alias="EMBEDDING_PROVIDER")
    embedding_dimensions: int = Field(768, alias="EMBEDDING_DIMENSIONS", ge=1)
    gemini_embedding_model: str = Field("gemini-embedding-001", alias="GEMINI_EMBEDDING_MODEL")
    openai_embedding_model: str = Field(
        "text-embedding-3-small", alias="OPENAI_EMBEDDING_MODEL"
    )
    rag_vector_top_k: int = Field(10, alias="RAG_VECTOR_TOP_K", ge=1)
    rag_bm25_top_k: int = Field(10, alias="RAG_BM25_TOP_K", ge=1)
    rag_rrf_k: int = Field(60, alias="RAG_RRF_K", ge=1)

    # Document upload
    upload_dir: str = Field("./uploads", alias="UPLOAD_DIR")
    max_upload_mb: int = Field(20, alias="MAX_UPLOAD_MB", ge=1)
    storage_backend: str = Field("local", alias="STORAGE_BACKEND")

    @field_validator("ai_provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        if value not in {"gemini", "groq", "openai"}:
            raise ValueError("AI_PROVIDER must be gemini, groq, or openai")
        return value

    @field_validator("embedding_provider")
    @classmethod
    def validate_embedding_provider(cls, value: str) -> str:
        if value not in {"gemini", "openai"}:
            raise ValueError("EMBEDDING_PROVIDER must be gemini or openai")
        return value

    @field_validator("storage_backend")
    @classmethod
    def validate_storage_backend(cls, value: str) -> str:
        if value != "local":
            raise ValueError(
                "STORAGE_BACKEND only supports 'local' today; "
                "an object-storage backend is a documented future addition"
            )
        return value

    @model_validator(mode="after")
    def validate_origins(self) -> "Settings":
        for origin in self.origins:
            parsed = urlparse(origin)
            if not parsed.scheme or not parsed.netloc:
                raise ValueError(f"Invalid client origin URL: {origin}")
        return self

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if not self.is_production:
            return self

        problems: list[str] = []

        if self.database_url == DEV_DATABASE_URL:
            problems.append("DATABASE_URL must be set in production")
        if self.client_origins == DEV_CLIENT_ORIGINS:
            problems.append("CLIENT_ORIGINS must be set in production")
        if self.session_secret == DEV_SESSION_SECRET:
            problems.append("SESSION_SECRET must be set in production")
        elif len(self.session_secret) < 32:
            problems.append(
                "SESSION_SECRET must contain at least 32 characters in production"
            )

        provider_keys = {
            "gemini": self.gemini_api_key,
            "groq": self.groq_api_key,
            "openai": self.openai_api_key,
        }
        if not provider_keys[self.ai_provider]:
            problems.append(
                f"The API key for AI_PROVIDER={self.ai_provider} is required in production"
            )
        if not provider_keys[self.embedding_provider]:
            problems.append(
                f"The API key for EMBEDDING_PROVIDER={self.embedding_provider} "
                "is required in production"
            )

        if problems:
            raise ValueError(
                "Missing/invalid production configuration: " + "; ".join(problems)
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.node_env == "production"

    @property
    def origins(self) -> list[str]:
        return [value.strip() for value in self.client_origins.split(",") if value.strip()]

    @property
    def log_level(self) -> str:
        if self.log_level_raw:
            return self.log_level_raw
        return "info" if self.is_production else "debug"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def embedding_model(self) -> str:
        return (
            self.gemini_embedding_model
            if self.embedding_provider == "gemini"
            else self.openai_embedding_model
        )

    @property
    def embedding_api_key(self) -> str:
        return self.gemini_api_key if self.embedding_provider == "gemini" else self.openai_api_key

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            return url
        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url[len("postgresql://"):]
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url[len("postgres://"):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
