from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import CleanupRun


async def record_run(
    db: AsyncSession, *, sweep_type: str, counts: dict, started_at: datetime
) -> CleanupRun:
    run = CleanupRun(sweep_type=sweep_type, counts=counts, started_at=started_at)
    db.add(run)
    await db.flush()
    return run


async def list_recent(db: AsyncSession, limit: int = 50) -> list[CleanupRun]:
    result = await db.execute(select(CleanupRun).order_by(CleanupRun.finished_at.desc()).limit(limit))
    return list(result.scalars().all())
