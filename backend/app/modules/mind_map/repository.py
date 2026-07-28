from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .model import MindMap


async def get_by_topic(db: AsyncSession, topic_id: int) -> MindMap | None:
    stmt = select(MindMap).where(MindMap.topic_id == topic_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def upsert(db: AsyncSession, *, topic_id: int, structure: dict) -> MindMap:
    stmt = (
        pg_insert(MindMap)
        .values(topic_id=topic_id, structure=structure)
        .on_conflict_do_update(index_elements=[MindMap.topic_id], set_={"structure": structure})
        .returning(MindMap)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.scalar_one()
