import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import metrics as metrics_module
from app.core.config import get_settings
from app.core.logging import current_correlation_id
from app.core.security import record_auth_failure


async def test_slow_query_is_logged_and_counted(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "slow_query_ms", 0)  # any query counts as "slow"
    before = metrics_module.SLOW_QUERIES._value.get()  # noqa: SLF001

    await db_session.execute(text("SELECT 1"))

    after = metrics_module.SLOW_QUERIES._value.get()  # noqa: SLF001
    assert after > before


async def test_fast_query_is_not_flagged_slow(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "slow_query_ms", 60_000)
    before = metrics_module.SLOW_QUERIES._value.get()  # noqa: SLF001

    await db_session.execute(text("SELECT 1"))

    after = metrics_module.SLOW_QUERIES._value.get()  # noqa: SLF001
    assert after == before


def test_record_auth_failure_increments_metric(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeRequest:
        client = type("client", (), {"host": "203.0.113.5"})()
        headers: dict = {}

    before = metrics_module.AUTH_FAILURES.labels("invalid_credentials")._value.get()  # noqa: SLF001

    record_auth_failure(FakeRequest(), reason="invalid_credentials")  # type: ignore[arg-type]

    after = metrics_module.AUTH_FAILURES.labels("invalid_credentials")._value.get()  # noqa: SLF001
    assert after == before + 1


async def test_request_id_is_echoed_and_available_as_correlation_id(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/usage/me", headers={"X-Request-Id": "test-correlation-abc"})
    assert response.status_code == 200
    assert response.headers["X-Request-Id"] == "test-correlation-abc"


def test_current_correlation_id_reads_bound_contextvar() -> None:
    import structlog

    structlog.contextvars.clear_contextvars()
    assert current_correlation_id() is None
    structlog.contextvars.bind_contextvars(request_id="abc-123")
    assert current_correlation_id() == "abc-123"
    structlog.contextvars.clear_contextvars()
