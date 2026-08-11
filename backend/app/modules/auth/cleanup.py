"""Idempotent sweep for expired server-side sessions. Safe to re-run: once
a row is past `expires_at` and deleted, a later run simply finds nothing
left to remove for it."""

import structlog
from sqlalchemy import delete, func

from ...db.session import get_sessionmaker
from .model import UserSession

logger = structlog.get_logger("study_assistant")


async def sweep_expired_sessions() -> dict[str, int]:
    async with get_sessionmaker()() as db:
        result = await db.execute(delete(UserSession).where(UserSession.expires_at < func.now()))
        await db.commit()
        deleted = result.rowcount or 0
    logger.info("expired_session_sweep_completed", deleted_count=deleted)
    return {"deletedCount": deleted}
