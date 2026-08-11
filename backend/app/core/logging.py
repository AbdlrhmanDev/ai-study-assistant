import logging
import re
import sys
import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .config import get_settings

REDACT_KEYS = {
    "password", "password_hash", "authorization", "cookie",
    "s3_secret_access_key", "s3_access_key_id", "redis_url", "session_secret",
    "database_url", "api_key", "gemini_api_key", "groq_api_key", "openai_api_key",
}
REDACTED = "[REDACTED]"

# Key-based redaction only catches values stored under a known-sensitive
# field name. This backstops values embedded in free-text log fields (e.g.
# an exception message that happened to include a connection string or an
# Authorization header value) that wouldn't otherwise be caught.
_SENSITIVE_VALUE_PATTERNS = (
    re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*://[^:\s]+:[^@\s]+@\S+"),  # user:pass@host connection strings
    re.compile(r"\bBearer\s+[A-Za-z0-9._-]+", re.IGNORECASE),  # Authorization: Bearer <token>
)


def _scrub_value_patterns(value: str) -> str:
    for pattern in _SENSITIVE_VALUE_PATTERNS:
        value = pattern.sub(REDACTED, value)
    return value
NOISY_THIRD_PARTY_LOGGERS = (
    "boto3",
    "botocore",
    "groq",
    "httpx",
    "httpcore",
    "multipart",
    "openai",
    "google_genai",
    "python_multipart",
    "s3transfer",
    "urllib3",
)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "cross-origin",
}


def _scrub(value: object) -> object:
    if isinstance(value, dict):
        return {
            key: (REDACTED if str(key).lower() in REDACT_KEYS else _scrub(val))
            for key, val in value.items()
        }
    if isinstance(value, list):
        return [_scrub(item) for item in value]
    if isinstance(value, str):
        return _scrub_value_patterns(value)
    return value


def _redact_processor(_logger: object, _method_name: str, event_dict: dict) -> dict:
    return _scrub(event_dict)  # type: ignore[return-value]


def configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)


    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        _redact_processor,
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ]
    structlog.configure(
        processors=shared_processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )

    renderer = (
        structlog.processors.JSONRenderer()
        if settings.is_production
        else structlog.dev.ConsoleRenderer()
    )
    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level)

    # Provider SDKs log handled HTTP failures (notably 429 failover) with full
    # tracebacks at DEBUG. Keep application debug logs useful without making an
    # expected provider fallback look like an unhandled server crash.
    for logger_name in NOISY_THIRD_PARTY_LOGGERS:
        logging.getLogger(logger_name).setLevel(logging.WARNING)


logger = structlog.get_logger("study_assistant")


def current_correlation_id() -> str | None:
    """The originating request's X-Request-Id, if this code is running
    within a request (bound by RequestContextMiddleware). Used to tag
    enqueued jobs so their logs can be correlated back to the request that
    triggered them."""
    return structlog.contextvars.get_contextvars().get("request_id")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns/propagates a request id, logs one line per request, and sets
    the security headers Express applied via helmet."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        settings = get_settings()
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)

        duration_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Request-Id"] = request_id
        for name, value in SECURITY_HEADERS.items():
            response.headers[name] = value
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"
            )

        if response.status_code >= 500:
            log = logger.error
        elif response.status_code >= 400:
            log = logger.warning
        else:
            log = logger.info
        log(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 1),
        )
        return response
