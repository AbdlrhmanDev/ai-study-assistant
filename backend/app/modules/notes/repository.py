from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..topics.model import Topic
from .model import Note


def _owned_notes_query(topic_id: int, user_id: int) -> Select:
    return (
        select(Note)
        .join(Topic, Topic.id == Note.topic_id)
        .where(Note.topic_id == topic_id, Topic.user_id == user_id)
    )


async def list_by_topic(db: AsyncSession, topic_id: int, user_id: int) -> list[Note]:
    stmt = _owned_notes_query(topic_id, user_id).order_by(Note.updated_at.desc(), Note.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id_for_user(db: AsyncSession, note_id: int, user_id: int) -> Note | None:
    stmt = (
        select(Note).join(Topic, Topic.id == Note.topic_id)
        .where(Note.id == note_id, Topic.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, topic_id: int, title: str, content: str) -> Note:
    note = Note(topic_id=topic_id, title=title, content=content)
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


async def update(db: AsyncSession, note: Note, *, title: str | None, content: str | None) -> Note:
    if title is not None:
        note.title = title
    if content is not None:
        note.content = content
    await db.flush()
    await db.refresh(note)
    return note


async def delete(db: AsyncSession, note: Note) -> None:
    await db.delete(note)


async def move_to_topic(db: AsyncSession, note: Note, target_topic_id: int) -> Note:
    note.topic_id = target_topic_id
    await db.flush()
    await db.refresh(note)
    return note


async def count_by_topic(db: AsyncSession, topic_id: int, user_id: int) -> int:
    stmt = (
        select(func.count(Note.id))
        .select_from(Note)
        .join(Topic, Topic.id == Note.topic_id)
        .where(Note.topic_id == topic_id, Topic.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


async def list_paginated_by_topic(
    db: AsyncSession, topic_id: int, user_id: int, limit: int, offset: int
) -> list[Note]:
    stmt = (
        _owned_notes_query(topic_id, user_id)
        .order_by(Note.updated_at.desc(), Note.id.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def search_by_topic(
    db: AsyncSession, topic_id: int, user_id: int, search_term: str, limit: int, offset: int
) -> list[Note]:
    pattern = f"%{search_term}%"
    stmt = (
        _owned_notes_query(topic_id, user_id)
        .where(or_(Note.title.ilike(pattern), Note.content.ilike(pattern)))
        .order_by(Note.updated_at.desc(), Note.id.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_search_by_topic(
    db: AsyncSession, topic_id: int, user_id: int, search_term: str
) -> int:
    pattern = f"%{search_term}%"
    stmt = (
        select(func.count(Note.id))
        .select_from(Note)
        .join(Topic, Topic.id == Note.topic_id)
        .where(
            Note.topic_id == topic_id,
            Topic.user_id == user_id,
            or_(Note.title.ilike(pattern), Note.content.ilike(pattern)),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one()
