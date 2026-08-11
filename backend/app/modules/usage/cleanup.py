"""Retention sweep for the AI usage/metrics ledger -- docs/legal/DATA_RETENTION.md
commits to a 13-month window. `usage_events` never stored raw prompts or
responses (only provider/model/token-count/cost metadata), so this is
pure row-count housekeeping, not a privacy-sensitive content purge."""

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import session_scope
from .model import UsageEvent

logger = structlog.get_logger("study_assistant")

RETENTION_MONTHS = 13


async def sweep_stale_usage_events(db: AsyncSession | None = None) -> dict[str, int]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_MONTHS * 30)
    async with session_scope(db) as session:
        result = await session.execute(delete(UsageEvent).where(UsageEvent.created_at < cutoff))
        await session.commit()
        deleted = result.rowcount or 0
    logger.info("stale_usage_events_swept", deleted_count=deleted)
    return {"deletedCount": deleted}
