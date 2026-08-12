from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from . import repository
from .exceptions import RebuildCooldownError

# Rebuilding calls the AI provider (and, for the KG, re-derives every
# concept/relation from scratch) -- cheap to spam by clicking twice, so a
# short cooldown sits on top of the existing in-flight dedup (which only
# stops a second request while one is already running, not one right after
# the last one finished).
REBUILD_COOLDOWN = timedelta(minutes=2)


async def get_build_status(db: AsyncSession, *, topic_id: int, build_type: str) -> dict:
    row = await repository.get_status(db, topic_id=topic_id, build_type=build_type)
    if row is None:
        return {"status": "completed", "errorMessage": None}
    return {"status": row.status, "errorMessage": row.error_message}


async def assert_rebuild_allowed(db: AsyncSession, *, topic_id: int, build_type: str) -> None:
    """Raises `RebuildCooldownError` if this topic's build just completed
    within the cooldown window. A `failed` status is exempt -- the user
    should be able to retry a failure immediately."""
    row = await repository.get_status(db, topic_id=topic_id, build_type=build_type)
    if row is None or row.status != "completed":
        return
    elapsed = datetime.now(timezone.utc) - row.updated_at
    if elapsed < REBUILD_COOLDOWN:
        retry_after = int((REBUILD_COOLDOWN - elapsed).total_seconds()) + 1
        raise RebuildCooldownError(retry_after)
