"""Idempotent cleanup sweep for uploads that never finished (crashed worker,
browser closed mid-upload, storage write that never got its status update).
Re-running after a partial run just finds fewer stuck rows -- once a document
is marked ``failed`` it no longer matches the sweep's query."""

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...db.session import session_scope
from .model import Document
from .storage import get_storage_backend

logger = structlog.get_logger("study_assistant")


async def sweep_abandoned_uploads(db: AsyncSession | None = None) -> dict[str, int]:
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.abandoned_upload_minutes)
    storage = get_storage_backend()
    failed_count = 0

    async with session_scope(db) as session:
        result = await session.execute(
            select(Document).where(
                Document.status.in_(("pending", "processing")),
                Document.created_at < cutoff,
            )
        )
        stuck = list(result.scalars().all())
        for document in stuck:
            if document.storage_path:
                try:
                    storage.delete(document.storage_path)
                except Exception:
                    logger.warning(
                        "abandoned_upload_storage_delete_failed",
                        document_id=document.id,
                        exc_info=True,
                    )
            document.status = "failed"
            document.error_message = "Upload did not complete in time and was cleaned up."
            failed_count += 1
        await session.commit()

    logger.info("abandoned_upload_sweep_completed", failed_count=failed_count)
    return {"failedCount": failed_count}
