from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .model import TopicBuildStatus


async def set_status(
    db: AsyncSession, *, topic_id: int, build_type: str, status: str, error_message: str | None = None
) -> None:
    stmt = pg_insert(TopicBuildStatus).values(
        topic_id=topic_id, build_type=build_type, status=status, error_message=error_message,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[TopicBuildStatus.topic_id, TopicBuildStatus.build_type],
        set_={"status": status, "error_message": error_message, "updated_at": func.now()},
    )
    await db.execute(stmt)


async def get_status(db: AsyncSession, *, topic_id: int, build_type: str) -> TopicBuildStatus | None:
    return await db.get(TopicBuildStatus, {"topic_id": topic_id, "build_type": build_type})
