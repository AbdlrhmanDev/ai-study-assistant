import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...db.session import session_scope
from ..graph_builds import repository as build_status_repository
from . import service

logger = structlog.get_logger("study_assistant")

BUILD_TYPE = "knowledge_graph"


async def _rebuild_graph_job(topic_id: int, user_id: int, db: AsyncSession | None = None) -> None:
    """When `db` is supplied (same-request inline fallback with no Redis
    configured), the original exception is re-raised after being recorded
    so the HTTP response still reflects it -- matching today's synchronous
    behavior for local dev/tests. A real background worker (db=None) never
    re-raises: it just records the failure and returns, like
    `_index_document` does."""
    reraise = db is not None
    async with session_scope(db) as session:
        try:
            await build_status_repository.set_status(
                session, topic_id=topic_id, build_type=BUILD_TYPE, status="processing"
            )
            await session.commit()

            await service.rebuild_graph(session, topic_id, user_id)

            await build_status_repository.set_status(
                session, topic_id=topic_id, build_type=BUILD_TYPE, status="completed"
            )
            await session.commit()
        except Exception as error:
            # Only roll back a session we own -- the caller's own session
            # (inline/test path) belongs to the request/test, which handles
            # its own transaction lifecycle; rolling it back here would
            # leave it unusable for whatever runs next in that same scope.
            if not reraise:
                await session.rollback()
            await build_status_repository.set_status(
                session, topic_id=topic_id, build_type=BUILD_TYPE, status="failed",
                error_message=str(error)[:500],
            )
            await session.commit()
            if reraise:
                raise
            logger.warning("knowledge_graph_rebuild_failed", topic_id=topic_id, exc_info=True)


async def enqueue_graph_rebuild(db: AsyncSession, topic_id: int, user_id: int) -> str:
    if not get_settings().redis_url:
        await _rebuild_graph_job(topic_id, user_id, db=db)
        return "inline-development"
    from ...core.jobs import enqueue
    from ...core.logging import current_correlation_id
    return await enqueue(
        "knowledge_graph.rebuild", {"topic_id": topic_id, "user_id": user_id},
        idempotency_key=f"knowledge_graph.rebuild:{topic_id}", user_id=user_id,
        correlation_id=current_correlation_id(),
    )
