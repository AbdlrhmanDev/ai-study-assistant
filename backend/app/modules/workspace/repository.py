from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import WorkspacePage


def _owned_query(user_id: int) -> Select:
    return select(WorkspacePage).where(WorkspacePage.user_id == user_id)


async def list_for_user(
    db: AsyncSession, user_id: int, topic_id: int | None = None
) -> list[WorkspacePage]:
    stmt = _owned_query(user_id)
    if topic_id is not None:
        stmt = stmt.where(WorkspacePage.topic_id == topic_id)
    stmt = stmt.order_by(WorkspacePage.updated_at.desc(), WorkspacePage.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id_for_user(db: AsyncSession, page_id: int, user_id: int) -> WorkspacePage | None:
    stmt = _owned_query(user_id).where(WorkspacePage.id == page_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession, *, user_id: int, title: str, topic_id: int | None
) -> WorkspacePage:
    page = WorkspacePage(user_id=user_id, title=title, topic_id=topic_id, blocks=[])
    db.add(page)
    await db.flush()
    await db.refresh(page)
    return page


async def update(
    db: AsyncSession, page: WorkspacePage, *, title: str | None, blocks: list[dict] | None
) -> WorkspacePage:
    if title is not None:
        page.title = title
    if blocks is not None:
        page.blocks = blocks
    await db.flush()
    await db.refresh(page)
    return page


async def set_topic(db: AsyncSession, page: WorkspacePage, topic_id: int | None) -> WorkspacePage:
    page.topic_id = topic_id
    await db.flush()
    await db.refresh(page)
    return page


async def delete(db: AsyncSession, page: WorkspacePage) -> None:
    await db.delete(page)
