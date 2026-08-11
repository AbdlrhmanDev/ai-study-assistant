"""Short-lived request-idempotency cache for expensive synchronous AI
generation endpoints (quiz/exam/flashcard generation stayed request/response
rather than moving to the durable job queue -- see PRODUCTION.md -- but a
double-submit or a client retry after a slow response must not call the AI
provider, and meter usage, twice).

Backed by Redis (shared across replicas) when `REDIS_URL` is set, an
in-process dict otherwise -- fine for a single local/dev instance, same
tradeoff the rest of the app makes for Redis-optional features.
"""

from __future__ import annotations

import json
import time
from collections.abc import Awaitable, Callable

from .config import get_settings

DEFAULT_TTL_SECONDS = 300

_memory_cache: dict[str, tuple[float, dict]] = {}


def _cache_key(user_id: int, scope: str, idempotency_key: str) -> str:
    return f"idempotency:{scope}:{user_id}:{idempotency_key}"


async def get_cached_response(user_id: int, scope: str, idempotency_key: str) -> dict | None:
    key = _cache_key(user_id, scope, idempotency_key)
    settings = get_settings()
    if settings.redis_url:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            raw = await redis.get(key)
        finally:
            await redis.aclose()
        return json.loads(raw) if raw else None

    entry = _memory_cache.get(key)
    if entry is None:
        return None
    expires_at, payload = entry
    if expires_at < time.monotonic():
        _memory_cache.pop(key, None)
        return None
    return payload


async def cache_response(
    user_id: int, scope: str, idempotency_key: str, response: dict, *, ttl_seconds: int = DEFAULT_TTL_SECONDS
) -> None:
    key = _cache_key(user_id, scope, idempotency_key)
    settings = get_settings()
    if settings.redis_url:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            await redis.set(key, json.dumps(response), ex=ttl_seconds)
        finally:
            await redis.aclose()
        return

    _memory_cache[key] = (time.monotonic() + ttl_seconds, response)


async def with_idempotency(
    user_id: int, scope: str, idempotency_key: str | None, compute: Callable[[], Awaitable[dict]]
) -> dict:
    """No key -> always compute (most callers/older clients). With a key,
    a cached response from a recent identical submission short-circuits
    `compute` entirely, so a double-click/retried request never re-runs an
    AI generation call (and never records a second usage event for it)."""
    if not idempotency_key:
        return await compute()
    cached = await get_cached_response(user_id, scope, idempotency_key)
    if cached is not None:
        return cached
    result = await compute()
    await cache_response(user_id, scope, idempotency_key, result)
    return result
