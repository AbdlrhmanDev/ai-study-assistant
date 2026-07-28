from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import AppError
from app.modules.ai import provider


class APIConnectionError(Exception):
    pass


class AuthenticationError(Exception):
    pass


@pytest.mark.asyncio
async def test_provider_retries_transient_connection_error(monkeypatch):
    calls = 0

    def generate():
        nonlocal calls
        calls += 1
        if calls < 3:
            raise APIConnectionError("Connection error")
        return "OK", "groq", "test-model"

    sleep = AsyncMock()
    monkeypatch.setattr(provider.asyncio, "sleep", sleep)

    result = await provider._run_provider_with_retry(generate)

    assert result == ("OK", "groq", "test-model")
    assert calls == 3
    assert sleep.await_count == 2


@pytest.mark.asyncio
async def test_provider_does_not_retry_non_transient_error(monkeypatch):
    calls = 0

    def generate():
        nonlocal calls
        calls += 1
        raise AuthenticationError("Invalid API key")

    sleep = AsyncMock()
    monkeypatch.setattr(provider.asyncio, "sleep", sleep)

    with pytest.raises(AuthenticationError, match="Invalid API key"):
        await provider._run_provider_with_retry(generate)

    assert calls == 1
    sleep.assert_not_awaited()


@pytest.mark.asyncio
async def test_provider_falls_back_immediately_after_rate_limit(monkeypatch):
    calls = []

    class RateLimitError(Exception):
        status_code = 429

    def call_factory(provider_name):
        def generate():
            calls.append(provider_name)
            if provider_name == "groq":
                raise RateLimitError("Daily limit reached")
            return "OK", "gemini", "test-model"
        return generate

    monkeypatch.setattr(provider, "_available_providers", lambda: ["groq", "gemini"])
    sleep = AsyncMock()
    monkeypatch.setattr(provider.asyncio, "sleep", sleep)

    result = await provider._run_provider_with_fallback(call_factory)

    assert result == ("OK", "gemini", "test-model")
    assert calls == ["groq", "gemini"]
    sleep.assert_not_awaited()


@pytest.mark.asyncio
async def test_provider_returns_friendly_message_when_all_limits_are_exhausted(monkeypatch):
    class RateLimitError(Exception):
        status_code = 429

    def call_factory(provider_name):
        def generate():
            raise RateLimitError(f"{provider_name} limit reached")
        return generate

    monkeypatch.setattr(provider, "_available_providers", lambda: ["groq", "gemini"])

    with pytest.raises(AppError) as raised:
        await provider._run_provider_with_fallback(call_factory)

    assert raised.value.status_code == 429
    assert raised.value.message == (
        "The AI service has reached its usage limit. "
        "Please try again later or contact the administrator."
    )
