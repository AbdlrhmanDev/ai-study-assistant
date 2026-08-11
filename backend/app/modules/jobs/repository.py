from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .model import BackgroundJob


async def create(
    db: AsyncSession,
    *,
    job_id: str,
    job_type: str,
    payload: dict,
    max_attempts: int,
    idempotency_key: str | None,
    correlation_id: str | None,
    user_id: int | None,
) -> BackgroundJob:
    job = BackgroundJob(
        id=job_id, type=job_type, payload=payload, max_attempts=max_attempts,
        idempotency_key=idempotency_key, correlation_id=correlation_id, user_id=user_id,
    )
    db.add(job)
    await db.flush()
    return job


async def get_active_by_idempotency_key(db: AsyncSession, idempotency_key: str) -> BackgroundJob | None:
    """Only queued/running jobs count as "the same in-flight request" --
    a completed/failed/dead job under this key must never block a later,
    legitimate retry from reusing it."""
    result = await db.execute(
        select(BackgroundJob)
        .where(
            BackgroundJob.idempotency_key == idempotency_key,
            BackgroundJob.status.in_(("queued", "running")),
        )
        .order_by(BackgroundJob.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get(db: AsyncSession, job_id: str) -> BackgroundJob | None:
    return await db.get(BackgroundJob, job_id)


async def claim(db: AsyncSession, job_id: str) -> bool:
    """Atomic queued -> running transition. Returns False (no rows
    matched) if another worker already claimed it -- the caller must not
    dispatch the job in that case."""
    result = await db.execute(
        update(BackgroundJob)
        .where(BackgroundJob.id == job_id, BackgroundJob.status == "queued")
        .values(status="running", started_at=func.now())
    )
    await db.commit()
    return result.rowcount == 1


async def mark_completed(db: AsyncSession, job_id: str) -> None:
    await db.execute(
        update(BackgroundJob)
        .where(BackgroundJob.id == job_id)
        .values(status="completed", finished_at=func.now())
    )
    await db.commit()


async def mark_retrying(db: AsyncSession, job_id: str, *, attempt: int, error: str) -> None:
    await db.execute(
        update(BackgroundJob)
        .where(BackgroundJob.id == job_id)
        .values(status="queued", attempt=attempt, last_error=error[:2000])
    )
    await db.commit()


async def mark_dead(db: AsyncSession, job_id: str, *, attempt: int, error: str) -> None:
    await db.execute(
        update(BackgroundJob)
        .where(BackgroundJob.id == job_id)
        .values(status="dead", attempt=attempt, last_error=error[:2000], finished_at=func.now())
    )
    await db.commit()


async def reset_for_retry(db: AsyncSession, job_id: str) -> BackgroundJob | None:
    """Admin retry of a dead-letter job: back to queued with a fresh
    attempt budget."""
    job = await db.get(BackgroundJob, job_id)
    if job is None or job.status != "dead":
        return None
    job.status = "queued"
    job.attempt = 0
    job.last_error = None
    job.started_at = None
    job.finished_at = None
    await db.commit()
    return job


async def discard(db: AsyncSession, job_id: str) -> bool:
    result = await db.execute(
        delete(BackgroundJob).where(BackgroundJob.id == job_id, BackgroundJob.status == "dead")
    )
    await db.commit()
    return result.rowcount == 1


async def list_dead_letter(db: AsyncSession, limit: int = 100) -> list[BackgroundJob]:
    result = await db.execute(
        select(BackgroundJob)
        .where(BackgroundJob.status == "dead")
        .order_by(BackgroundJob.finished_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def recover_stuck_jobs(db: AsyncSession, *, stuck_after_minutes: int) -> int:
    """A job stuck `running` past this threshold means its worker crashed
    mid-dispatch without a chance to report failure -- reset it to queued
    so another worker picks it back up. Re-running this is a no-op once
    nothing is stuck (idempotent)."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stuck_after_minutes)
    result = await db.execute(
        update(BackgroundJob)
        .where(BackgroundJob.status == "running", BackgroundJob.started_at < cutoff)
        .values(status="queued")
    )
    await db.commit()
    return result.rowcount or 0


async def discard_old_dead_letter(db: AsyncSession, *, older_than_days: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    result = await db.execute(
        delete(BackgroundJob).where(BackgroundJob.status == "dead", BackgroundJob.finished_at < cutoff)
    )
    return result.rowcount or 0


async def metrics(db: AsyncSession) -> dict:
    queue_depth = await db.scalar(
        select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "queued")
    )
    running = await db.scalar(
        select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "running")
    )
    failed = await db.scalar(
        select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "failed")
    )
    dead = await db.scalar(
        select(func.count(BackgroundJob.id)).where(BackgroundJob.status == "dead")
    )
    oldest_queued = await db.scalar(
        select(func.min(BackgroundJob.created_at)).where(BackgroundJob.status == "queued")
    )
    oldest_age_seconds = None
    if oldest_queued is not None:
        oldest_age_seconds = (datetime.now(timezone.utc) - oldest_queued).total_seconds()
    return {
        "queueDepth": int(queue_depth or 0),
        "running": int(running or 0),
        "failed": int(failed or 0),
        "deadLetter": int(dead or 0),
        "oldestQueuedAgeSeconds": oldest_age_seconds,
    }
