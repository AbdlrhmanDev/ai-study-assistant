import hashlib
import secrets
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi.concurrency import run_in_threadpool
from limits import parse
from limits.storage import MemoryStorage, storage_from_string
from limits.strategies import FixedWindowRateLimiter
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Receive, Scope, Send

from ..db.session import get_sessionmaker
from ..modules.auth import repository as session_repository
from ..shared.responses import error_body
from .config import get_settings
from .exceptions import AppError
from .logging import logger

# --------------------------------------------------------------------------
# Password hashing
# --------------------------------------------------------------------------


async def hash_password(password: str) -> str:
    hashed = await run_in_threadpool(bcrypt.hashpw, password.encode(), bcrypt.gensalt(rounds=12))
    return hashed.decode()


async def verify_password(password: str, password_hash: str) -> bool:
    return await run_in_threadpool(bcrypt.checkpw, password.encode(), password_hash.encode())


# --------------------------------------------------------------------------
# Server-side session store (Postgres-backed, mirrors connect-pg-simple)
# --------------------------------------------------------------------------

SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60


def _cookie_name() -> str:
    return "__Host-sid" if get_settings().is_production else "sid"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def regenerate_session(request: Request) -> None:
    """Issue a fresh session id, invalidating the old one server-side.

    Call this before writing a user into the session on register/login, to
    prevent session fixation (matches the Express app's
    `req.session.regenerate()` before `req.session.user = user`).
    """
    request.state.current_session_token = _new_token()
    request.scope["session"] = {}


def destroy_session(request: Request) -> None:
    """Mark the session for deletion (logout)."""
    request.state.session_action = "destroy"
    request.scope["session"] = {}


class SessionMiddleware(BaseHTTPMiddleware):
    """Server-side session store: an opaque random token in an httpOnly
    cookie, session data kept in Postgres. Writes ``request.scope["session"]``
    -- the same scope key Starlette's own SessionMiddleware uses -- so
    ``request.session`` keeps working unchanged everywhere else in the app.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        cookie_name = _cookie_name()
        incoming_token = request.cookies.get(cookie_name)

        data: dict = {}
        if incoming_token:
            async with get_sessionmaker()() as db:
                row = await session_repository.get_active(
                    db, _hash_token(incoming_token), datetime.now(timezone.utc)
                )
                if row is not None:
                    data = dict(row.data)

        request.scope["session"] = data
        request.state.session_token = incoming_token
        request.state.session_action = None

        response = await call_next(request)

        old_token = incoming_token
        current_token = getattr(request.state, "current_session_token", old_token)
        action = getattr(request.state, "session_action", None)
        session_data = request.scope.get("session") or {}

        if action == "destroy":
            token_to_delete = current_token or old_token
            if token_to_delete:
                async with get_sessionmaker()() as db:
                    await session_repository.delete_by_hash(db, _hash_token(token_to_delete))
                    await db.commit()
            response.delete_cookie(cookie_name, path="/")
            return response

        regenerated = current_token != old_token
        if not regenerated and not session_data:
            return response

        async with get_sessionmaker()() as db:
            if regenerated and old_token:
                await session_repository.delete_by_hash(db, _hash_token(old_token))

            if session_data:
                if not current_token:
                    current_token = _new_token()
                expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=SESSION_MAX_AGE_SECONDS
                )
                user_id = (session_data.get("user") or {}).get("id")
                await session_repository.upsert(
                    db,
                    token_hash=_hash_token(current_token),
                    user_id=user_id,
                    data=session_data,
                    expires_at=expires_at,
                )
                await db.commit()
                # Frontend and backend are deployed as separate services on
                # different subdomains (e.g. Railway's *.up.railway.app),
                # which browsers treat as cross-site -- SameSite=Lax cookies
                # are never attached to those requests. SameSite=None is only
                # valid with Secure, so this stays Lax/non-secure locally
                # where both run on http://localhost (same-site already).
                is_production = get_settings().is_production
                response.set_cookie(
                    cookie_name,
                    current_token,
                    max_age=SESSION_MAX_AGE_SECONDS,
                    httponly=True,
                    samesite="none" if is_production else "lax",
                    secure=is_production,
                    path="/",
                )
            else:
                await db.commit()

        return response


# --------------------------------------------------------------------------
# Rate limiting
# --------------------------------------------------------------------------
#
# Counters live in Redis (shared across replicas) when REDIS_URL is set, and
# in per-process memory otherwise -- see PRODUCTION.md. If Redis is briefly
# unreachable, slowapi's in-memory fallback keeps requests flowing (each
# instance just reverts to counting independently until Redis recovers)
# rather than 500ing every request.


def _rate_limit_storage_uri() -> str:
    return get_settings().redis_url or "memory://"


_default_api_limit = f"{get_settings().api_rate_limit}/15minutes"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[_default_api_limit],
    storage_uri=_rate_limit_storage_uri(),
    swallow_errors=True,
    in_memory_fallback_enabled=True,
    in_memory_fallback=[_default_api_limit],
)


def ai_rate_limit_key(request: Request) -> str:
    user = (request.scope.get("session") or {}).get("user")
    return f"user:{user['id']}" if user else get_remote_address(request)


async def rate_limit_exceeded_handler(request: Request, _exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        error_body("Too many requests, please try again later", request_id=request_id),
        status_code=429,
    )


# Auth tier (register/login): counts only failed attempts, mirroring Express's
# `skipSuccessfulRequests: true`. slowapi's decorator API has no such option,
# so this is implemented directly against the `limits` library slowapi wraps.
# Unlike the general `limiter` above, this bypasses slowapi entirely, so it
# doesn't get slowapi's built-in in-memory fallback -- fail open ourselves
# below instead of letting a Redis outage block every login attempt.
_auth_limiter_storage = storage_from_string(_rate_limit_storage_uri())
_auth_limiter_strategy = FixedWindowRateLimiter(_auth_limiter_storage)


def _auth_limit_item():
    return parse(f"{get_settings().auth_rate_limit}/15minutes")


def check_auth_rate_limit(request: Request) -> None:
    key = get_remote_address(request)
    try:
        allowed = _auth_limiter_strategy.test(_auth_limit_item(), key)
    except Exception as error:
        logger.warning("auth_rate_limiter_storage_unavailable", error=str(error))
        return
    if not allowed:
        raise AppError("Too many requests, please try again later", 429)


def record_auth_failure(request: Request) -> None:
    key = get_remote_address(request)
    try:
        _auth_limiter_strategy.hit(_auth_limit_item(), key)
    except Exception as error:
        logger.warning("auth_rate_limiter_storage_unavailable", error=str(error))


def reset_auth_rate_limiter_for_testing() -> None:
    """Test-only: the auth rate limiter's counters are an in-memory
    singleton that otherwise persists for the life of the process, which
    would leak between test functions sharing the same client IP."""
    global _auth_limiter_storage, _auth_limiter_strategy
    _auth_limiter_storage = MemoryStorage()
    _auth_limiter_strategy = FixedWindowRateLimiter(_auth_limiter_storage)


# --------------------------------------------------------------------------
# Request body size limit (mirrors express.json({ limit: "100kb" }))
# --------------------------------------------------------------------------


class BodySizeLimitMiddleware:
    """Mirrors express.json({ limit: "100kb" }) for ordinary JSON requests --
    but multipart/form-data (file uploads) gets the much larger
    settings.max_upload_bytes ceiling instead, enforced again (more
    precisely, per-file) by the upload endpoint itself."""

    def __init__(self, app: ASGIApp, max_bytes: int = 100_000) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        content_type = headers.get(b"content-type", b"").decode("latin-1")
        max_bytes = (
            get_settings().max_upload_bytes
            if content_type.startswith("multipart/form-data")
            else self.max_bytes
        )

        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                too_large = int(content_length) > max_bytes
            except ValueError:
                too_large = False
            if too_large:
                response = JSONResponse(
                    {"message": "Request entity too large"}, status_code=413
                )
                await response(scope, receive, send)
                return

        total = 0

        async def limited_receive() -> dict:
            nonlocal total
            message = await receive()
            if message["type"] == "http.request":
                total += len(message.get("body") or b"")
                if total > max_bytes:
                    raise HTTPException(status_code=413, detail="Request entity too large")
            return message

        await self.app(scope, limited_receive, send)
