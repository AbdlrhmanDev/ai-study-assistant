from __future__ import annotations

import json
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

# Per-feature beta caps, overridable per-deployment via AI_FEATURE_LIMITS
# (JSON, only the features you want to override). Anything omitted keeps
# these defaults. `daily`/`monthly` are both optional per feature.
DEFAULT_AI_FEATURE_LIMITS: dict[str, dict[str, int]] = {
    "chat": {"daily": 60, "monthly": 500},
    "image_chat": {"daily": 20, "monthly": 150},
    "embeddings": {"daily": 300, "monthly": 4000},
    "quiz": {"daily": 15, "monthly": 150},
    "exam": {"daily": 8, "monthly": 60},
    "flashcards": {"daily": 15, "monthly": 150},
    "mind_map": {"daily": 10, "monthly": 80},
    "knowledge_graph": {"daily": 10, "monthly": 80},
    "workspace_ai": {"daily": 30, "monthly": 300},
    "agents": {"daily": 20, "monthly": 200},
    "coach": {"daily": 10, "monthly": 100},
}

# Account plan tiers. Billing is deliberately not wired up yet (Phase 4);
# these tiers exist so quota/storage enforcement can vary per account from a
# single config source. A user's plan is a `users.plan` column (default
# "beta"); an operator sets it directly in the DB today. `feature_multiplier`
# scales the per-feature daily/monthly AI caps above; storage_mb and
# monthly_request_limit override the flat globals for that plan.
DEFAULT_PLAN_TIERS: dict[str, dict] = {
    "beta": {
        "label": "Beta",
        "monthly_price_usd": 0,
        "storage_mb": 500,
        "monthly_request_limit": 500,
        "feature_multiplier": 1,
    },
    "pro": {
        "label": "Pro",
        "monthly_price_usd": 12,
        "storage_mb": 5000,
        "monthly_request_limit": 5000,
        "feature_multiplier": 5,
    },
}


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
    # Total storage across all of a user's documents, not per-file. There's
    # no billing/plan tiers yet (Phase 2), so this is one flat beta-wide cap
    # rather than a per-plan quota -- differentiating by plan can layer on
    # top of this same accounting once plans exist.
    max_storage_mb_per_user: int = Field(500, alias="MAX_STORAGE_MB_PER_USER", ge=1)
    # Account plan tiers. `default_plan` applies to accounts that were never
    # assigned one; `PLAN_TIERS` (JSON) can override the built-in tiers per
    # deployment. Storage and AI quotas are resolved per account plan.
    default_plan: str = Field("beta", alias="DEFAULT_PLAN")
    plan_tiers_raw: str = Field("", alias="PLAN_TIERS")
    storage_backend: str = Field("local", alias="STORAGE_BACKEND")
    s3_bucket: str = Field("", alias="S3_BUCKET")
    s3_region: str = Field("auto", alias="S3_REGION")
    s3_endpoint_url: str = Field("", alias="S3_ENDPOINT_URL")
    s3_access_key_id: str = Field("", alias="S3_ACCESS_KEY_ID")
    s3_secret_access_key: str = Field("", alias="S3_SECRET_ACCESS_KEY")
    signed_url_ttl_seconds: int = Field(900, alias="SIGNED_URL_TTL_SECONDS", ge=60, le=86400)
    # A document stuck in pending/processing past this many minutes (crashed
    # worker, browser closed mid-upload before storage.save() completed) is
    # swept by cleanup.sweep_abandoned_uploads and marked failed.
    abandoned_upload_minutes: int = Field(60, alias="ABANDONED_UPLOAD_MINUTES", ge=1)
    clamav_host: str = Field("", alias="CLAMAV_HOST")
    clamav_port: int = Field(3310, alias="CLAMAV_PORT", ge=1, le=65535)
    malware_scan_required: bool = Field(False, alias="MALWARE_SCAN_REQUIRED")

    # Durable jobs, monitoring, and beta quotas.
    job_queue_name: str = Field("studia:jobs", alias="JOB_QUEUE_NAME")
    job_max_retries: int = Field(4, alias="JOB_MAX_RETRIES", ge=1, le=20)
    sentry_dsn: str = Field("", alias="SENTRY_DSN")
    slow_query_ms: int = Field(500, alias="SLOW_QUERY_MS", ge=1)
    ai_monthly_request_limit: int = Field(500, alias="AI_MONTHLY_REQUEST_LIMIT", ge=1)
    ai_feature_limits_raw: str = Field("", alias="AI_FEATURE_LIMITS")
    # JSON map, for example {"chat":"openai","quiz":"groq"}. Missing
    # features keep AI_PROVIDER, and unavailable providers fall back safely.
    ai_feature_providers_raw: str = Field("", alias="AI_FEATURE_PROVIDERS")
    ai_artifact_cache_ttl_seconds: int = Field(
        86400, alias="AI_ARTIFACT_CACHE_TTL_SECONDS", ge=60, le=2592000
    )
    soft_limit_warning_threshold: float = Field(
        0.8, alias="SOFT_LIMIT_WARNING_THRESHOLD", ge=0.0, le=1.0
    )
    admin_emails: str = Field("", alias="ADMIN_EMAILS")
    smtp_host: str = Field("", alias="SMTP_HOST")
    smtp_port: int = Field(587, alias="SMTP_PORT", ge=1, le=65535)
    smtp_username: str = Field("", alias="SMTP_USERNAME")
    smtp_password: str = Field("", alias="SMTP_PASSWORD")
    smtp_from_email: str = Field("", alias="SMTP_FROM_EMAIL")
    smtp_use_tls: bool = Field(True, alias="SMTP_USE_TLS")
    app_public_url: str = Field("http://localhost:3000", alias="APP_PUBLIC_URL")

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
        if value not in {"local", "s3"}:
            raise ValueError("STORAGE_BACKEND must be local or s3")
        return value

    @field_validator("redis_url", mode="before")
    @classmethod
    def normalize_redis_url(cls, value: object) -> str:
        normalized = str(value or "").strip()
        # Railway resolves `${{Service.VARIABLE}}` itself. In a local .env,
        # python-dotenv can reduce that unresolved reference to a lone `}`.
        if normalized == "}" or normalized.startswith("${{"):
            return ""
        if normalized and urlparse(normalized).scheme not in {"redis", "rediss", "memory"}:
            raise ValueError("REDIS_URL must start with redis:// or rediss://")
        return normalized

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
        if self.storage_backend != "s3":
            problems.append("STORAGE_BACKEND must be s3 in production")
        elif not all((self.s3_bucket, self.s3_access_key_id, self.s3_secret_access_key)):
            problems.append("S3_BUCKET and S3 credentials are required in production")
        if not self.redis_url:
            problems.append("REDIS_URL is required in production for durable jobs")
        if self.malware_scan_required and not self.clamav_host:
            problems.append("CLAMAV_HOST is required when MALWARE_SCAN_REQUIRED=true")

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
    def feature_limits(self) -> dict[str, dict[str, int]]:
        merged = {key: dict(value) for key, value in DEFAULT_AI_FEATURE_LIMITS.items()}
        if self.ai_feature_limits_raw:
            try:
                overrides = json.loads(self.ai_feature_limits_raw)
            except (json.JSONDecodeError, TypeError):
                overrides = {}
            if isinstance(overrides, dict):
                for feature, limits in overrides.items():
                    if isinstance(limits, dict):
                        merged.setdefault(feature, {}).update(limits)
        return merged

    @property
    def feature_providers(self) -> dict[str, str]:
        if not self.ai_feature_providers_raw:
            return {}
        try:
            parsed = json.loads(self.ai_feature_providers_raw)
        except (json.JSONDecodeError, TypeError):
            return {}
        if not isinstance(parsed, dict):
            return {}
        return {
            str(feature): str(provider)
            for feature, provider in parsed.items()
            if provider in {"gemini", "groq", "openai"}
        }

    @property
    def plan_tiers(self) -> dict[str, dict]:
        """Plan definitions keyed by plan slug. JSON env overrides (PLAN_TIERS)
        merge onto the built-in tiers -- specify only the fields you want to
        change; unknown keys are ignored."""
        merged = {slug: dict(tier) for slug, tier in DEFAULT_PLAN_TIERS.items()}
        if self.plan_tiers_raw:
            try:
                overrides = json.loads(self.plan_tiers_raw)
            except (json.JSONDecodeError, TypeError):
                overrides = {}
            if isinstance(overrides, dict):
                for slug, tier in overrides.items():
                    if isinstance(tier, dict):
                        merged.setdefault(str(slug), {}).update(tier)
        return merged

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def max_storage_bytes_per_user(self) -> int:
        return self.max_storage_mb_per_user * 1024 * 1024

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
