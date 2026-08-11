from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass

import structlog
from redis.asyncio import Redis

from .config import get_settings

logger = structlog.get_logger("study_assistant")


@dataclass
class Job:
    id: str
    type: str
    payload: dict
    attempt: int = 0
    correlation_id: str | None = None

    def dumps(self) -> str:
        return json.dumps(self.__dict__, separators=(",", ":"))


async def _push(job: Job) -> None:
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        await redis.lpush(settings.job_queue_name, job.dumps())
    finally:
        await redis.aclose()


async def enqueue(
    job_type: str,
    payload: dict,
    *,
    idempotency_key: str | None = None,
    correlation_id: str | None = None,
    user_id: int | None = None,
) -> str:
    """Durably tracks the job in Postgres (for admin visibility, atomic
    status transitions, and idempotency) before pushing it onto the Redis
    transport queue."""
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL is required for durable background jobs")

    from ..modules.jobs import service as jobs_service

    job_id, created = await jobs_service.enqueue_job(
        job_type, payload, idempotency_key=idempotency_key,
        correlation_id=correlation_id, user_id=user_id,
    )
    if not created:
        return job_id  # an active job already covers this request
    await _push(Job(id=job_id, type=job_type, payload=payload, correlation_id=correlation_id))
    return job_id


async def requeue_existing(job_id: str, job_type: str, payload: dict) -> None:
    """Push an already-tracked (and already-reset-to-queued) BackgroundJob
    row back onto the Redis transport -- used by admin dead-letter retry."""
    if not get_settings().redis_url:
        return
    await _push(Job(id=job_id, type=job_type, payload=payload))


async def _dispatch(job: Job) -> None:
    if job.type == "document.index":
        from ..modules.ai.indexing import _index_document
        await _index_document(int(job.payload["document_id"]))
    elif job.type == "note.index":
        from ..modules.ai.indexing import _index_note
        await _index_note(int(job.payload["note_id"]))
    elif job.type == "memory.extract":
        from ..modules.memory.indexing import _extract_memory
        await _extract_memory(
            int(job.payload["user_id"]), job.payload["question"], job.payload["answer"]
        )
    elif job.type == "knowledge_graph.rebuild":
        from ..modules.knowledge_graph.jobs import _rebuild_graph_job
        await _rebuild_graph_job(int(job.payload["topic_id"]), int(job.payload["user_id"]))
    elif job.type == "mind_map.rebuild":
        from ..modules.mind_map.jobs import _rebuild_mind_map_job
        await _rebuild_mind_map_job(int(job.payload["topic_id"]), int(job.payload["user_id"]))
    elif job.type == "cleanup.abandoned_uploads":
        from ..modules.ai.cleanup import sweep_abandoned_uploads
        await sweep_abandoned_uploads()
    elif job.type == "cleanup.expired_sessions":
        from ..modules.auth.cleanup import sweep_expired_sessions
        await sweep_expired_sessions()
    else:
        raise ValueError(f"Unknown job type: {job.type}")


async def run_worker() -> None:
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL is required for the job worker")

    from ..modules.jobs import service as jobs_service

    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    logger.info("job_worker_started", queue=settings.job_queue_name)
    recovered = await jobs_service.recover_stuck_jobs()
    if recovered:
        logger.info("stuck_jobs_recovered", count=recovered)
    try:
        while True:
            item = await redis.brpop(settings.job_queue_name, timeout=5)
            if item is None:
                continue
            job = Job(**json.loads(item[1]))

            claimed = await jobs_service.claim_job(job.id)
            if not claimed:
                # Already claimed/finished by another worker, or a stale
                # redelivery of a job whose tracking row is gone (discarded
                # from the dead-letter queue) -- safe to drop.
                logger.info("job_skip_not_claimable", job_id=job.id, job_type=job.type)
                continue

            # Binds this job's correlation_id (the originating HTTP request's
            # X-Request-Id, if any) into every log line emitted while
            # dispatching it -- including nested AI-provider-call logs --
            # so one ID greps across frontend console, backend request log,
            # and worker/job log for the same user action.
            structlog.contextvars.clear_contextvars()
            if job.correlation_id:
                structlog.contextvars.bind_contextvars(correlation_id=job.correlation_id)

            started = time.perf_counter()
            try:
                await _dispatch(job)
                duration_ms = round((time.perf_counter() - started) * 1000)
                await jobs_service.complete_job(job.id)
                logger.info(
                    "job_completed", job_id=job.id, job_type=job.type,
                    attempt=job.attempt, duration_ms=duration_ms, final_state="completed",
                )
            except Exception as error:
                duration_ms = round((time.perf_counter() - started) * 1000)
                job.attempt += 1
                final_state = await jobs_service.fail_job(
                    job.id, attempt=job.attempt, max_attempts=settings.job_max_retries, error=str(error),
                )
                logger.exception(
                    "job_failed", job_id=job.id, job_type=job.type,
                    attempt=job.attempt, duration_ms=duration_ms, final_state=final_state,
                )
                if final_state == "queued":
                    await asyncio.sleep(min(2 ** job.attempt, 30))
                    await redis.lpush(settings.job_queue_name, job.dumps())
    finally:
        await redis.aclose()


async def run_cleanup_once() -> None:
    """One-shot retention sweep entrypoint -- `python -m app.core.jobs
    --cleanup`, meant to be triggered on a schedule (Railway Cron or
    equivalent; see PRODUCTION.md), not run continuously like the worker."""
    from ..modules.cleanup.service import run_all_sweeps

    results = await run_all_sweeps()
    logger.info("cleanup_run_finished", **{k: v for k, v in results.items()})


if __name__ == "__main__":
    import sys

    if "--cleanup" in sys.argv:
        asyncio.run(run_cleanup_once())
    else:
        asyncio.run(run_worker())
