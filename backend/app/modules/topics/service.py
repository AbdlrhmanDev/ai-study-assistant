from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.model import Document
from ..notes.model import Note
from ..study_history import repository as study_history_repository
from . import repository
from .exceptions import TopicNotFoundError
from .model import Topic
from .schema import TopicCreate, TopicUpdate


async def get_owned_topic_or_404(db: AsyncSession, topic_id: int, user_id: int) -> Topic:
    topic = await repository.get_by_id_for_user(db, topic_id, user_id)
    if topic is None:
        raise TopicNotFoundError()
    return topic


async def list_topics(db: AsyncSession, user_id: int) -> list[Topic]:
    return await repository.list_by_user(db, user_id)


async def create_topic(db: AsyncSession, user_id: int, payload: TopicCreate) -> Topic:
    topic = await repository.create(
        db, user_id=user_id, title=payload.title, description=payload.description
    )
    await study_history_repository.record_activity_safely(
        db,
        user_id=user_id,
        topic_id=topic.id,
        activity_type="topic_created",
        description=f"Created topic: {topic.title}",
    )
    from ..growth.service import add_event
    add_event(db, user_id, "first_topic", {"topicId": topic.id})
    add_event(db, user_id, "activation", {"source": "topic_created"})
    await db.commit()
    await db.refresh(topic)
    return topic


async def get_topic(db: AsyncSession, topic_id: int, user_id: int) -> Topic:
    return await get_owned_topic_or_404(db, topic_id, user_id)


async def update_topic(
    db: AsyncSession, topic_id: int, user_id: int, payload: TopicUpdate
) -> Topic:
    topic = await get_owned_topic_or_404(db, topic_id, user_id)
    topic = await repository.update(
        db,
        topic,
        title=payload.title,
        description_provided="description" in payload.model_fields_set,
        description=payload.description,
    )
    await study_history_repository.record_activity_safely(
        db,
        user_id=user_id,
        topic_id=topic.id,
        activity_type="topic_updated",
        description=f"Updated topic: {topic.title}",
    )
    await db.commit()
    await db.refresh(topic)
    return topic


async def delete_topic(db: AsyncSession, topic_id: int, user_id: int) -> None:
    topic = await get_owned_topic_or_404(db, topic_id, user_id)
    await repository.delete(db, topic)
    await study_history_repository.record_activity_safely(
        db, user_id=user_id, topic_id=topic_id, activity_type="topic_deleted",
        description=f"Deleted topic {topic.title}",
    )
    await db.commit()


async def material_signature(db: AsyncSession, topic_id: int, user_id: int) -> str:
    """A cheap content fingerprint of everything AI artifact generation
    reads for a topic (notes + completed documents). Artifact caches key on
    this so a note/document edit or upload invalidates previously generated
    quizzes/exams/flashcards instead of serving stale AI output."""
    notes_count, notes_updated = (
        await db.execute(
            select(func.count(Note.id), func.max(Note.updated_at)).where(Note.topic_id == topic_id, Note.user_id == user_id)
        )
    ).first() or (0, None)
    documents_count, documents_updated = (
        await db.execute(
            select(func.count(Document.id), func.max(Document.updated_at)).where(Document.topic_id == topic_id)
        )
    ).first() or (0, None)
    return (
        f"n{notes_count}:{notes_updated.isoformat() if notes_updated else '-'}"
        f"|d{documents_count}:{documents_updated.isoformat() if documents_updated else '-'}"
    )
