from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

import structlog

from ...db.session import get_sessionmaker
from . import repository

logger = structlog.get_logger("study_assistant")


async def _run_and_record(sweep_type: str, sweep: Callable[[], Awaitable[dict]]) -> dict:
    started_at = datetime.now(timezone.utc)
    counts = await sweep()
    async with get_sessionmaker()() as db:
        await repository.record_run(db, sweep_type=sweep_type, counts=counts, started_at=started_at)
        await db.commit()
    logger.info("cleanup_sweep_completed", sweep_type=sweep_type, **counts)
    return counts


async def run_all_sweeps() -> dict[str, dict]:
    """Runs every retention sweep once and records an auditable
    (content-free) result for each -- the entrypoint for
    `python -m app.core.jobs --cleanup`, meant to be triggered on a
    schedule (Railway Cron or equivalent; see PRODUCTION.md)."""
    from ..ai.cleanup import sweep_abandoned_uploads
    from ..auth.cleanup import sweep_expired_sessions
    from ..jobs.service import sweep_old_dead_letter
    from ..usage.cleanup import sweep_stale_usage_events

    results: dict[str, dict] = {}
    for sweep_type, sweep in (
        ("abandoned_uploads", sweep_abandoned_uploads),
        ("expired_sessions", sweep_expired_sessions),
        ("dead_letter_jobs", sweep_old_dead_letter),
        ("stale_usage_events", sweep_stale_usage_events),
    ):
        try:
            results[sweep_type] = await _run_and_record(sweep_type, sweep)
        except Exception:
            logger.exception("cleanup_sweep_failed", sweep_type=sweep_type)
            results[sweep_type] = {"error": True}
    return results


async def list_recent_runs() -> list[dict]:
    async with get_sessionmaker()() as db:
        runs = await repository.list_recent(db)
        return [
            {
                "id": run.id, "sweepType": run.sweep_type, "counts": run.counts,
                "startedAt": run.started_at.isoformat(), "finishedAt": run.finished_at.isoformat(),
            }
            for run in runs
        ]
