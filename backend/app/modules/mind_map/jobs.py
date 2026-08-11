import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...db.session import session_scope
from ..graph_builds import repository as build_status_repository
from . import service

logger = structlog.get_logger("study_assistant")

BUILD_TYPE = "mind_map"


async def _rebuild_mind_map_job(topic_id: int, user_id: int, db: AsyncSession | None = None) -> None:
    reraise = db is not None
    async with session_scope(db) as session:
        try:
            await build_status_repository.set_status(
                session, topic_id=topic_id, build_type=BUILD_TYPE, status="processing"
            )
            await session.commit()

            await service.rebuild_mind_map(session, topic_id, user_id)

            await build_status_repository.set_status(
                session, topic_id=topic_id, build_type=BUILD_TYPE, status="completed"
            )
            await session.commit()
        except Exception as error:
            # Only roll back a session we own -- see knowledge_graph.jobs
            # for why the caller's own (inline/test) session must not be
            # rolled back here.
            if not reraise:
                await session.rollback()
            await build_status_repository.set_status(
                session, topic_id=topic_id, build_type=BUILD_TYPE, status="failed",
                error_message=str(error)[:500],
            )
            await session.commit()
            if reraise:
                raise
            logger.warning("mind_map_rebuild_failed", topic_id=topic_id, exc_info=True)


async def enqueue_mind_map_rebuild(db: AsyncSession, topic_id: int, user_id: int) -> str:
    if not get_settings().redis_url:
        await _rebuild_mind_map_job(topic_id, user_id, db=db)
        return "inline-development"
    from ...core.jobs import enqueue
    from ...core.logging import current_correlation_id
    return await enqueue(
        "mind_map.rebuild", {"topic_id": topic_id, "user_id": user_id},
        idempotency_key=f"mind_map.rebuild:{topic_id}", user_id=user_id,
        correlation_id=current_correlation_id(),
    )
