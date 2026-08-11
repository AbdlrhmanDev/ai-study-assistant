import asyncio
import uuid

import pytest
from fakeredis import aioredis as fake_aioredis

from app.core.config import get_settings
from app.modules.jobs import repository as jobs_repository
from app.modules.jobs import service as jobs_service


@pytest.fixture
def fake_redis_url(monkeypatch: pytest.MonkeyPatch):
    """Points REDIS_URL at an in-memory fake and patches the Redis class
    `app.core.jobs` uses, so enqueue/worker tests never need a real Redis.
    Each test gets its own uniquely-named fake server: fakeredis shares
    in-memory state across `FakeRedis.from_url()` calls with the *same*
    URL, and a `run_worker()` cancelled mid-BRPOP (how these tests end)
    can leave a stale blocking-pop waiter registered against a shared
    server that then swallows the next test's push."""
    unique_url = f"redis://fake-jobs-test-{uuid.uuid4().hex}/0"
    monkeypatch.setattr(get_settings(), "redis_url", unique_url)
    import app.core.jobs as core_jobs

    monkeypatch.setattr(core_jobs, "Redis", fake_aioredis.FakeRedis)
    return unique_url


async def test_enqueue_job_dedupes_active_jobs_by_idempotency_key(db_session) -> None:
    first_id, first_created = await jobs_service.enqueue_job(
        "document.index", {"document_id": 1}, idempotency_key="document.index:1"
    )
    second_id, second_created = await jobs_service.enqueue_job(
        "document.index", {"document_id": 1}, idempotency_key="document.index:1"
    )
    assert first_created is True
    assert second_created is False
    assert second_id == first_id


async def test_enqueue_job_allows_new_job_after_previous_completed(db_session) -> None:
    first_id, _ = await jobs_service.enqueue_job(
        "document.index", {"document_id": 2}, idempotency_key="document.index:2"
    )
    await jobs_service.complete_job(first_id)

    second_id, second_created = await jobs_service.enqueue_job(
        "document.index", {"document_id": 2}, idempotency_key="document.index:2"
    )

    assert second_created is True
    assert second_id != first_id


async def test_claim_is_atomic_only_one_caller_wins(db_session) -> None:
    job_id, _ = await jobs_service.enqueue_job("note.index", {"note_id": 9})

    first_claim = await jobs_service.claim_job(job_id)
    second_claim = await jobs_service.claim_job(job_id)

    assert first_claim is True
    assert second_claim is False


async def test_recover_stuck_jobs_resets_old_running_jobs(db_session) -> None:
    from sqlalchemy import text

    from app.modules.jobs.model import BackgroundJob

    job_id, _ = await jobs_service.enqueue_job("note.index", {"note_id": 10})
    await jobs_service.claim_job(job_id)
    await db_session.execute(
        BackgroundJob.__table__.update().where(BackgroundJob.id == job_id).values(
            started_at=text("now() - interval '1 hour'")
        )
    )
    await db_session.commit()

    recovered_count = await jobs_repository.recover_stuck_jobs(db_session, stuck_after_minutes=15)
    await db_session.commit()

    assert recovered_count == 1
    job = await jobs_repository.get(db_session, job_id)
    assert job.status == "queued"


async def test_fail_job_dies_after_max_attempts(db_session) -> None:
    job_id, _ = await jobs_service.enqueue_job("note.index", {"note_id": 11})
    await jobs_service.claim_job(job_id)

    result = await jobs_service.fail_job(job_id, attempt=1, max_attempts=1, error="boom")

    assert result == "dead"
    dead = await jobs_service.list_dead_letter()
    assert any(job["id"] == job_id for job in dead)


async def test_admin_retry_and_discard_dead_letter_job(db_session) -> None:
    job_id, _ = await jobs_service.enqueue_job("note.index", {"note_id": 12})
    await jobs_service.claim_job(job_id)
    await jobs_service.fail_job(job_id, attempt=1, max_attempts=1, error="boom")

    discarded_wrong_status = await jobs_service.discard_job("not-a-real-id")
    assert discarded_wrong_status is False

    discarded = await jobs_service.discard_job(job_id)
    assert discarded is True
    job = await jobs_repository.get(db_session, job_id)
    assert job is None


async def test_worker_processes_enqueued_job_end_to_end(fake_redis_url, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.core.jobs as core_jobs

    processed: list[str] = []

    async def fake_dispatch(job) -> None:
        processed.append(job.id)

    monkeypatch.setattr(core_jobs, "_dispatch", fake_dispatch)

    job_id = await core_jobs.enqueue("note.index", {"note_id": 42})

    try:
        await asyncio.wait_for(core_jobs.run_worker(), timeout=2)
    except asyncio.TimeoutError:
        pass

    assert processed == [job_id]
    job = await jobs_service.get_job(job_id)
    assert job.status == "completed"


async def test_worker_sends_permanently_failing_job_to_dead_letter(
    fake_redis_url, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.core.jobs as core_jobs

    monkeypatch.setattr(get_settings(), "job_max_retries", 1)

    async def always_fails(job) -> None:
        raise RuntimeError("simulated permanent failure")

    monkeypatch.setattr(core_jobs, "_dispatch", always_fails)

    job_id = await core_jobs.enqueue("note.index", {"note_id": 43})

    try:
        await asyncio.wait_for(core_jobs.run_worker(), timeout=2)
    except asyncio.TimeoutError:
        pass

    job = await jobs_service.get_job(job_id)
    assert job.status == "dead"
    assert job.last_error and "simulated permanent failure" in job.last_error
