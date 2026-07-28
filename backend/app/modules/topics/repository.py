from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import Topic


async def list_by_user(db: AsyncSession, user_id: int) -> list[Topic]:
    result = await db.execute(
        select(Topic).where(Topic.user_id == user_id).order_by(Topic.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id_for_user(db: AsyncSession, topic_id: int, user_id: int) -> Topic | None:
    result = await db.execute(
        select(Topic).where(Topic.id == topic_id, Topic.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, user_id: int, title: str, description: str | None) -> Topic:
    topic = Topic(user_id=user_id, title=title, description=description)
    db.add(topic)
    await db.flush()
    await db.refresh(topic)
    return topic


async def update(
    db: AsyncSession,
    topic: Topic,
    *,
    title: str | None,
    description_provided: bool,
    description: str | None,
) -> Topic:
    if title is not None:
        topic.title = title
    if description_provided:
        topic.description = description
    await db.flush()
    await db.refresh(topic)
    return topic


async def delete(db: AsyncSession, topic: Topic) -> None:
    await db.delete(topic)
