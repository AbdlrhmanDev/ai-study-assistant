from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from ...shared.pagination import build_pagination_meta
from ..ai import indexing as ai_indexing
from ..ai import repository as ai_repository
from ..study_history import repository as study_history_repository
from ..topics import service as topics_service
from . import repository
from .exceptions import NoteNotFoundError
from .model import Note
from .schema import MoveNote, NoteCreate, NoteUpdate


async def get_owned_note_or_404(db: AsyncSession, note_id: int, user_id: int) -> Note:
    note = await repository.get_by_id_for_user(db, note_id, user_id)
    if note is None:
        raise NoteNotFoundError()
    return note


async def list_notes(db: AsyncSession, topic_id: int, user_id: int) -> list[Note]:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    return await repository.list_by_topic(db, topic_id, user_id)


async def get_paginated_notes(
    db: AsyncSession, topic_id: int, user_id: int, page: int, limit: int
) -> dict:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    offset = (page - 1) * limit
    notes = await repository.list_paginated_by_topic(db, topic_id, user_id, limit, offset)
    total = await repository.count_by_topic(db, topic_id, user_id)
    return {"notes": notes, "pagination": build_pagination_meta(total, page, limit)}


async def search_notes(
    db: AsyncSession, topic_id: int, user_id: int, search_term: str, page: int, limit: int
) -> dict:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    offset = (page - 1) * limit
    notes = await repository.search_by_topic(db, topic_id, user_id, search_term, limit, offset)
    total = await repository.count_search_by_topic(db, topic_id, user_id, search_term)
    return {"notes": notes, "pagination": build_pagination_meta(total, page, limit)}


async def create_note(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    topic_id: int,
    user_id: int,
    payload: NoteCreate,
) -> Note:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    note = await repository.create(
        db, topic_id=topic_id, title=payload.title, content=payload.content
    )
    await study_history_repository.record_activity_safely(
        db,
        user_id=user_id,
        topic_id=topic_id,
        activity_type="note_created",
        description=f"Created note: {note.title}",
    )
    await db.commit()
    await db.refresh(note)
    await ai_indexing.enqueue_note_index(note.id)
    return note


async def get_note(db: AsyncSession, note_id: int, user_id: int) -> Note:
    return await get_owned_note_or_404(db, note_id, user_id)


async def update_note(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    note_id: int,
    user_id: int,
    payload: NoteUpdate,
) -> Note:
    note = await get_owned_note_or_404(db, note_id, user_id)
    note = await repository.update(db, note, title=payload.title, content=payload.content)
    await study_history_repository.record_activity_safely(
        db,
        user_id=user_id,
        topic_id=note.topic_id,
        activity_type="note_updated",
        description=f"Updated note: {note.title}",
    )
    await db.commit()
    await db.refresh(note)
    await ai_indexing.enqueue_note_index(note.id)
    return note


async def move_note(db: AsyncSession, note_id: int, user_id: int, payload: MoveNote) -> Note:
    note = await get_owned_note_or_404(db, note_id, user_id)
    await topics_service.get_owned_topic_or_404(db, payload.targetTopicId, user_id)
    note = await repository.move_to_topic(db, note, payload.targetTopicId)
    await ai_repository.update_chunk_topic_for_note(db, note.id, payload.targetTopicId)
    await study_history_repository.record_activity_safely(
        db,
        user_id=user_id,
        topic_id=note.topic_id,
        activity_type="note_moved",
        description=f"Moved note: {note.title}",
    )
    await db.commit()
    await db.refresh(note)
    return note


async def delete_note(db: AsyncSession, note_id: int, user_id: int) -> None:
    note = await get_owned_note_or_404(db, note_id, user_id)
    await repository.delete(db, note)
    await db.commit()
