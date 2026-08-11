import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_sessionmaker
from app.modules.ai import cleanup as ai_cleanup
from app.modules.ai.model import Document
from app.modules.auth import cleanup as auth_cleanup
from app.modules.auth.model import UserSession
from app.modules.cleanup import service as cleanup_service
from app.modules.cleanup.model import CleanupRun
from app.modules.jobs import service as jobs_service
from app.modules.topics.model import Topic
from app.modules.usage import cleanup as usage_cleanup
from app.modules.usage.model import UsageEvent
from app.modules.users.model import User


async def test_sweep_abandoned_uploads_removes_stuck_document_and_storage(
    db_session: AsyncSession, test_user: User, tmp_path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    topic = Topic(user_id=test_user.id, title="Cleanup test", description=None)
    db_session.add(topic)
    await db_session.flush()

    storage_path = "documents/x/1/source.txt"
    stored_file = tmp_path / storage_path
    stored_file.parent.mkdir(parents=True, exist_ok=True)
    stored_file.write_text("hi")
    stuck = Document(
        topic_id=topic.id, title="stuck", original_filename="stuck.txt", content_type="text/plain",
        status="processing", storage_path=storage_path,
    )
    db_session.add(stuck)
    await db_session.flush()
    await db_session.execute(
        Document.__table__.update().where(Document.id == stuck.id).values(
            created_at=text("now() - interval '2 days'")
        )
    )
    await db_session.commit()

    result = await ai_cleanup.sweep_abandoned_uploads(db_session)

    assert result["failedCount"] == 1
    assert not stored_file.exists()


async def test_sweep_expired_sessions_removes_only_expired_rows() -> None:
    """`sweep_expired_sessions` (like the rest of app.core.jobs' cleanup
    dispatch) always opens its own independent, really-committing session --
    so the rows it needs to see must be really committed too, not sitting
    in db_session's rolled-back savepoint. user_id=None sidesteps needing a
    real committed user for the FK."""
    expired_id = f"expired-{uuid.uuid4().hex}"
    active_id = f"active-{uuid.uuid4().hex}"
    async with get_sessionmaker()() as db:
        db.add_all([
            UserSession(id=expired_id, user_id=None, data={}, expires_at=datetime.now(timezone.utc) - timedelta(days=1)),
            UserSession(id=active_id, user_id=None, data={}, expires_at=datetime.now(timezone.utc) + timedelta(days=1)),
        ])
        await db.commit()

    await auth_cleanup.sweep_expired_sessions()

    async with get_sessionmaker()() as db:
        remaining = (await db.execute(select(UserSession.id))).scalars().all()
    assert active_id in remaining
    assert expired_id not in remaining


async def test_sweep_stale_usage_events_removes_old_keeps_recent(db_session: AsyncSession) -> None:
    old_event = UsageEvent(
        user_id=None, feature="chat", provider="gemini", model="gemini-2.5-flash",
        input_tokens=1, output_tokens=1, latency_ms=10, outcome="success",
    )
    recent_event = UsageEvent(
        user_id=None, feature="chat", provider="gemini", model="gemini-2.5-flash",
        input_tokens=1, output_tokens=1, latency_ms=10, outcome="success",
    )
    db_session.add_all([old_event, recent_event])
    await db_session.flush()
    await db_session.execute(
        UsageEvent.__table__.update().where(UsageEvent.id == old_event.id).values(
            created_at=text("now() - interval '14 months'")
        )
    )
    await db_session.commit()

    result = await usage_cleanup.sweep_stale_usage_events(db_session)

    assert result["deletedCount"] == 1
    remaining_ids = (await db_session.execute(select(UsageEvent.id))).scalars().all()
    assert recent_event.id in remaining_ids
    assert old_event.id not in remaining_ids


async def test_sweep_old_dead_letter_removes_only_jobs_past_retention() -> None:
    old_job_id, _ = await jobs_service.enqueue_job("note.index", {"note_id": 1})
    await jobs_service.claim_job(old_job_id)
    await jobs_service.fail_job(old_job_id, attempt=1, max_attempts=1, error="boom")

    recent_job_id, _ = await jobs_service.enqueue_job("note.index", {"note_id": 2})
    await jobs_service.claim_job(recent_job_id)
    await jobs_service.fail_job(recent_job_id, attempt=1, max_attempts=1, error="boom")

    from app.modules.jobs.model import BackgroundJob

    async with get_sessionmaker()() as db:
        await db.execute(
            BackgroundJob.__table__.update().where(BackgroundJob.id == old_job_id).values(
                finished_at=text("now() - interval '20 days'")
            )
        )
        await db.commit()

    result = await jobs_service.sweep_old_dead_letter(older_than_days=14)

    assert result["discardedCount"] == 1
    assert await jobs_service.get_job(old_job_id) is None
    assert await jobs_service.get_job(recent_job_id) is not None


async def test_run_all_sweeps_records_content_free_cleanup_runs() -> None:
    results = await cleanup_service.run_all_sweeps()

    assert set(results.keys()) == {
        "abandoned_uploads", "expired_sessions", "dead_letter_jobs", "stale_usage_events",
    }
    for sweep_type, counts in results.items():
        assert "error" not in counts, f"{sweep_type} sweep raised: {counts}"
        assert all(isinstance(value, int) for value in counts.values())

    runs = await cleanup_service.list_recent_runs()
    recorded_types = {run["sweepType"] for run in runs}
    assert recorded_types == set(results.keys())
    for run in runs:
        assert isinstance(run["counts"], dict)
        dumped = str(run)
        assert "@" not in dumped  # no email/content ever ends up in a recorded run


@pytest_asyncio.fixture
async def committed_admin():
    async with get_sessionmaker()() as db:
        user = User(
            name="Cleanup Admin", email=f"cleanup-admin-{uuid.uuid4()}@example.com",
            password_hash="not-a-real-hash",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    yield user
    async with get_sessionmaker()() as db:
        await db.execute(delete(User).where(User.id == user.id))
        await db.commit()


async def test_admin_cleanup_runs_rejects_non_admin(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/admin/cleanup/runs")
    assert response.status_code == 404


async def test_admin_cleanup_runs_allows_admin(
    client: AsyncClient, committed_admin: User, monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.main import app as fastapi_app
    from app.modules.auth.dependencies import get_current_user

    monkeypatch.setattr(get_settings(), "admin_emails", committed_admin.email)

    def override_get_current_user() -> dict:
        return {"id": committed_admin.id, "name": committed_admin.name, "email": committed_admin.email}

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        await cleanup_service.run_all_sweeps()
        response = await client.get("/api/v1/admin/cleanup/runs")
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert len(response.json()["runs"]) >= 4
