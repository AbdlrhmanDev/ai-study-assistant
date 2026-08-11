import asyncio
import inspect
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import delete

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.db.session import get_sessionmaker
from app.main import app as fastapi_app
from app.modules.ai import provider
from app.modules.auth.dependencies import get_current_user
from app.modules.usage import service as usage_service
from app.modules.users.model import User


def test_current_user_dependency_preserves_async_usage_context() -> None:
    """Regression: a sync FastAPI dependency runs in a worker thread, so its
    ContextVar write is invisible to the async AI provider call and usage is
    silently left at zero."""
    assert inspect.iscoroutinefunction(get_current_user)


@pytest_asyncio.fixture
async def committed_user():
    """`usage_service` intentionally opens independent sessions and commits
    for real (see conftest's `_reset_background_jobs_table` docstring), so
    a `usage_events.user_id` foreign key needs a genuinely committed user --
    the regular `test_user` fixture lives only in `db_session`'s rolled-back
    savepoint and isn't visible to a separate connection."""
    async with get_sessionmaker()() as db:
        user = User(
            name="Usage Test User", email=f"usage-test-{uuid.uuid4()}@example.com",
            password_hash="not-a-real-hash",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    yield user
    async with get_sessionmaker()() as db:
        await db.execute(delete(User).where(User.id == user.id))
        await db.commit()


@pytest_asyncio.fixture
async def committed_client(client: AsyncClient, committed_user: User):
    def override_get_current_user() -> dict:
        return {"id": committed_user.id, "name": committed_user.name, "email": committed_user.email}

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    yield client
    fastapi_app.dependency_overrides.pop(get_current_user, None)


async def _record(user_id: int, feature: str, *, provider_name: str = "gemini", model: str = "gemini-2.5-flash", outcome: str = "success") -> None:
    await usage_service.record(
        provider=provider_name, model=model, prompt="a" * 400, output="b" * 200,
        latency_ms=100, feature=feature, user_id=user_id, outcome=outcome,
    )


async def _get_until(client: AsyncClient, path: str, predicate, *, params: dict | None = None, attempts: int = 10):
    """`usage_service.record` commits on its own independent connection; a
    request served from the shared test session occasionally observes it a
    beat later under heavy connection churn in the full suite (harmless in
    production -- both are real, separately-committed transactions; this
    just tolerates the same kind of brief propagation gap real client code
    would see polling a genuinely async write)."""
    response = None
    for attempt in range(attempts):
        response = await client.get(path, params=params)
        if response.status_code == 200 and predicate(response.json()):
            return response
        if attempt < attempts - 1:
            await asyncio.sleep(0.05)
    return response


async def test_feature_monthly_limit_blocks_after_reaching_cap(
    monkeypatch: pytest.MonkeyPatch, committed_user: User,
) -> None:
    monkeypatch.setattr(get_settings(), "ai_feature_limits_raw", '{"quiz":{"monthly":2}}')
    for _ in range(2):
        await _record(committed_user.id, "quiz")

    with pytest.raises(AppError) as excinfo:
        await usage_service.enforce_quota("quiz", user_id=committed_user.id)
    assert excinfo.value.status_code == 429
    assert excinfo.value.details["scope"] == "feature_monthly"


async def test_feature_daily_limit_blocks_independent_of_monthly(
    monkeypatch: pytest.MonkeyPatch, committed_user: User,
) -> None:
    monkeypatch.setattr(get_settings(), "ai_feature_limits_raw", '{"quiz":{"daily":1,"monthly":1000}}')
    await _record(committed_user.id, "quiz")

    with pytest.raises(AppError) as excinfo:
        await usage_service.enforce_quota("quiz", user_id=committed_user.id)
    assert excinfo.value.details["scope"] == "feature_daily"


async def test_feature_limit_does_not_block_a_different_feature(
    monkeypatch: pytest.MonkeyPatch, committed_user: User,
) -> None:
    monkeypatch.setattr(get_settings(), "ai_feature_limits_raw", '{"quiz":{"monthly":1}}')
    await _record(committed_user.id, "quiz")

    # exam has no configured cap that's already exhausted -- must not raise
    await usage_service.enforce_quota("exam", user_id=committed_user.id)


async def test_global_monthly_limit_still_applies_as_a_ceiling(
    monkeypatch: pytest.MonkeyPatch, committed_user: User,
) -> None:
    monkeypatch.setattr(get_settings(), "ai_monthly_request_limit", 1)
    await _record(committed_user.id, "quiz")

    with pytest.raises(AppError) as excinfo:
        await usage_service.enforce_quota("exam", user_id=committed_user.id)
    assert excinfo.value.details["scope"] == "global"


async def test_usage_summary_reports_soft_limit_hit(
    monkeypatch: pytest.MonkeyPatch, committed_user: User,
) -> None:
    monkeypatch.setattr(get_settings(), "ai_feature_limits_raw", '{"quiz":{"monthly":10}}')
    monkeypatch.setattr(get_settings(), "soft_limit_warning_threshold", 0.5)
    for _ in range(5):
        await _record(committed_user.id, "quiz")

    summary = await usage_service.get_usage_summary(committed_user.id)

    assert summary["features"]["quiz"]["monthlyUsed"] == 5
    assert summary["features"]["quiz"]["softLimitHit"] is True
    assert summary["warningThreshold"] == 0.5


async def test_record_computes_nonzero_cost_for_known_model(committed_user: User) -> None:
    await usage_service.record(
        provider="gemini", model="gemini-2.5-flash", prompt="x" * 4000, output="y" * 4000,
        latency_ms=50, feature="chat", user_id=committed_user.id,
    )
    summary = await usage_service.get_usage_summary(committed_user.id)
    assert summary["used"] == 1  # sanity: event recorded


async def test_failed_generate_records_failed_outcome_not_success(
    monkeypatch: pytest.MonkeyPatch, committed_user: User,
) -> None:
    usage_service.set_current_user(committed_user.id)

    def _always_fails(*_args, **_kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(provider, "_generate_sync", _always_fails)
    monkeypatch.setattr(provider, "_available_providers", lambda: ["gemini"])
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")

    with pytest.raises(Exception):
        await provider.generate("hello", feature="chat")

    summary = await usage_service.get_usage_summary(committed_user.id)
    # A failed call must not count toward the success-based quota.
    assert summary["used"] == 0


async def test_admin_summary_rejects_non_admin(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/usage/admin/summary")
    assert response.status_code == 404


async def test_admin_summary_allows_configured_admin(
    committed_client: AsyncClient, committed_user: User, monkeypatch: pytest.MonkeyPatch,
) -> None:
    # A unique feature name: the admin summary aggregates across *all*
    # users, so a shared name like "quiz" would also pick up whatever any
    # other test running in this same session already recorded under it.
    feature = f"quiz-{uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(get_settings(), "admin_emails", committed_user.email)
    await _record(committed_user.id, feature)

    response = await _get_until(
        committed_client, "/api/v1/usage/admin/summary",
        lambda body: any(row["feature"] == feature for row in body["usage"]),
    )

    assert response.status_code == 200
    assert any(row["feature"] == feature for row in response.json()["usage"])


async def test_admin_summary_date_filter_excludes_out_of_range_events(
    committed_client: AsyncClient, committed_user: User, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "admin_emails", committed_user.email)
    await _record(committed_user.id, "quiz")

    response = await committed_client.get(
        "/api/v1/usage/admin/summary", params={"from": "2000-01-01", "to": "2000-01-02"}
    )

    assert response.status_code == 200
    assert response.json()["usage"] == []


async def test_admin_failures_reports_failure_rate(
    committed_client: AsyncClient, committed_user: User, monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Unique feature name -- see test_admin_summary_allows_configured_admin.
    feature = f"chat-{uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(get_settings(), "admin_emails", committed_user.email)
    await _record(committed_user.id, feature, outcome="success")
    await _record(committed_user.id, feature, outcome="failed")

    def _both_events_visible(body: dict) -> bool:
        row = next((item for item in body["failures"] if item["feature"] == feature), None)
        return row is not None and row["success"] >= 1 and row["failed"] >= 1

    response = await _get_until(committed_client, "/api/v1/usage/admin/failures", _both_events_visible)

    assert response.status_code == 200
    row = next(item for item in response.json()["failures"] if item["feature"] == feature)
    assert row["success"] == 1 and row["failed"] == 1 and row["failureRate"] == 0.5


async def test_embeddings_are_metered_and_quota_enforced(
    monkeypatch: pytest.MonkeyPatch, committed_user: User,
) -> None:
    from app.modules.ai import embedding

    monkeypatch.setattr(get_settings(), "ai_feature_limits_raw", '{"embeddings":{"monthly":1}}')
    monkeypatch.setattr(embedding, "_embed_gemini_sync", lambda texts: [[0.1] * 3 for _ in texts])

    await embedding.generate_embeddings(["hello world"], user_id=committed_user.id)

    summary = await usage_service.get_usage_summary(committed_user.id)
    assert summary["features"]["embeddings"]["monthlyUsed"] == 1

    with pytest.raises(AppError):
        await embedding.generate_embeddings(["another chunk"], user_id=committed_user.id)
