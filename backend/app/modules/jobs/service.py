from __future__ import annotations

import uuid

from ...core.config import get_settings
from ...db.session import get_sessionmaker
from . import repository
from .model import BackgroundJob


async def enqueue_job(
    job_type: str,
    payload: dict,
    *,
    idempotency_key: str | None = None,
    correlation_id: str | None = None,
    user_id: int | None = None,
) -> tuple[str, bool]:
    """Returns (job_id, created). When `idempotency_key` matches a
    still-active (queued/running) job, returns that job's id with
    created=False instead of inserting a duplicate -- a double-submit
    dedupes, but a retry after completion/failure always gets a fresh job.
    A narrow race (two concurrent enqueues both miss an in-flight row) can
    still create two jobs; for the current idempotency-key call sites
    (re-triggered indexing, dead-letter retry) that's self-healing, not a
    correctness problem, so it isn't worth a stricter DB constraint."""
    async with get_sessionmaker()() as db:
        if idempotency_key is not None:
            existing = await repository.get_active_by_idempotency_key(db, idempotency_key)
            if existing is not None:
                return existing.id, False

        job_id = str(uuid.uuid4())
        job = await repository.create(
            db, job_id=job_id, job_type=job_type, payload=payload,
            max_attempts=get_settings().job_max_retries,
            idempotency_key=idempotency_key, correlation_id=correlation_id, user_id=user_id,
        )
        await db.commit()
        return job.id, True


async def claim_job(job_id: str) -> bool:
    async with get_sessionmaker()() as db:
        return await repository.claim(db, job_id)


async def get_job(job_id: str) -> BackgroundJob | None:
    async with get_sessionmaker()() as db:
        return await repository.get(db, job_id)


async def complete_job(job_id: str) -> None:
    async with get_sessionmaker()() as db:
        await repository.mark_completed(db, job_id)


async def fail_job(job_id: str, *, attempt: int, max_attempts: int, error: str) -> str:
    """Returns the resulting status ("queued" if retrying, "dead" otherwise)."""
    async with get_sessionmaker()() as db:
        if attempt >= max_attempts:
            await repository.mark_dead(db, job_id, attempt=attempt, error=error)
            return "dead"
        await repository.mark_retrying(db, job_id, attempt=attempt, error=error)
        return "queued"


async def recover_stuck_jobs(stuck_after_minutes: int = 15) -> int:
    async with get_sessionmaker()() as db:
        return await repository.recover_stuck_jobs(db, stuck_after_minutes=stuck_after_minutes)


async def get_metrics() -> dict:
    async with get_sessionmaker()() as db:
        return await repository.metrics(db)


async def list_dead_letter() -> list[dict]:
    async with get_sessionmaker()() as db:
        jobs = await repository.list_dead_letter(db)
        return [
            {
                "id": job.id, "type": job.type, "attempt": job.attempt,
                "maxAttempts": job.max_attempts, "lastError": job.last_error,
                "createdAt": job.created_at.isoformat(),
                "finishedAt": job.finished_at.isoformat() if job.finished_at else None,
            }
            for job in jobs
        ]


async def retry_dead_job(job_id: str) -> bool:
    async with get_sessionmaker()() as db:
        job = await repository.reset_for_retry(db, job_id)
    if job is None:
        return False
    from ...core.jobs import requeue_existing
    await requeue_existing(job.id, job.type, job.payload)
    return True


async def discard_job(job_id: str) -> bool:
    async with get_sessionmaker()() as db:
        return await repository.discard(db, job_id)


async def sweep_old_dead_letter(older_than_days: int = 14) -> dict[str, int]:
    async with get_sessionmaker()() as db:
        discarded = await repository.discard_old_dead_letter(db, older_than_days=older_than_days)
        await db.commit()
    return {"discardedCount": discarded}
