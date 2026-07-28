from datetime import datetime

from sqlalchemy import case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.model import Document
from ..notes.model import Note
from ..topics.model import Topic
from .model import Flashcard, FlashcardReview

# --------------------------------------------------------------------------
# Source (note/document) join -- for displaying "link to the original note
# or document" without needing ORM relationships (matches the join style
# already used by ai/repository.py::_chunk_source_join).
# --------------------------------------------------------------------------


def _source_columns():
    return (
        case(
            (Flashcard.note_id.isnot(None), literal("note")),
            (Flashcard.document_id.isnot(None), literal("document")),
            else_=literal(None),
        ).label("source_type"),
        func.coalesce(Note.title, Document.title).label("source_title"),
    )


def _source_join(stmt):
    return stmt.outerjoin(Note, Note.id == Flashcard.note_id).outerjoin(
        Document, Document.id == Flashcard.document_id
    )


async def list_by_topic(
    db: AsyncSession, topic_id: int, status: str | None = "active"
) -> list[tuple[Flashcard, str | None, str | None]]:
    stmt = _source_join(
        select(Flashcard, *_source_columns()).select_from(Flashcard)
    ).where(Flashcard.topic_id == topic_id)
    if status:
        stmt = stmt.where(Flashcard.status == status)
    stmt = stmt.order_by(Flashcard.created_at.desc())
    result = await db.execute(stmt)
    return [(row.Flashcard, row.source_type, row.source_title) for row in result]


async def due_queue(
    db: AsyncSession, topic_id: int, now: datetime, limit: int
) -> list[tuple[Flashcard, str | None, str | None]]:
    stmt = (
        _source_join(select(Flashcard, *_source_columns()).select_from(Flashcard))
        .where(Flashcard.topic_id == topic_id, Flashcard.status == "active", Flashcard.due_at <= now)
        .order_by(Flashcard.due_at)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [(row.Flashcard, row.source_type, row.source_title) for row in result]


async def due_queue_for_user(
    db: AsyncSession, user_id: int, now: datetime, limit: int
) -> list[tuple[Flashcard, str | None, str | None]]:
    stmt = (
        _source_join(select(Flashcard, *_source_columns()).select_from(Flashcard))
        .join(Topic, Topic.id == Flashcard.topic_id)
        .where(Topic.user_id == user_id, Flashcard.status == "active", Flashcard.due_at <= now)
        .order_by(Flashcard.due_at)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [(row.Flashcard, row.source_type, row.source_title) for row in result]


async def get_by_id_for_user(db: AsyncSession, flashcard_id: int, user_id: int) -> Flashcard | None:
    stmt = (
        select(Flashcard)
        .join(Topic, Topic.id == Flashcard.topic_id)
        .where(Flashcard.id == flashcard_id, Topic.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    topic_id: int,
    question: str,
    answer: str,
    explanation: str | None,
    origin: str,
    note_id: int | None = None,
    document_id: int | None = None,
    concept: str | None = None,
) -> Flashcard:
    flashcard = Flashcard(
        topic_id=topic_id,
        note_id=note_id,
        document_id=document_id,
        question=question,
        answer=answer,
        explanation=explanation,
        origin=origin,
        concept=concept,
    )
    db.add(flashcard)
    await db.flush()
    await db.refresh(flashcard)
    return flashcard


async def update(
    db: AsyncSession,
    flashcard: Flashcard,
    *,
    question: str | None,
    answer: str | None,
    explanation: str | None,
    explanation_provided: bool,
) -> Flashcard:
    if question is not None:
        flashcard.question = question
    if answer is not None:
        flashcard.answer = answer
    if explanation_provided:
        flashcard.explanation = explanation
    await db.flush()
    await db.refresh(flashcard)
    return flashcard


async def set_status(db: AsyncSession, flashcard: Flashcard, status: str) -> Flashcard:
    flashcard.status = status
    await db.flush()
    await db.refresh(flashcard)
    return flashcard


async def replace_generated_content(
    db: AsyncSession,
    flashcard: Flashcard,
    *,
    question: str,
    answer: str,
    explanation: str | None,
    concept: str | None = None,
) -> Flashcard:
    """Used by regenerate: overwrite Q&A with a fresh AI pass, resetting
    scheduling progress since the card's content has effectively changed."""
    flashcard.question = question
    flashcard.answer = answer
    flashcard.explanation = explanation
    if concept:
        flashcard.concept = concept
    flashcard.repetitions = 0
    flashcard.ease_factor = 2.5
    flashcard.interval_days = 0
    flashcard.due_at = func.now()
    flashcard.last_reviewed_at = None
    flashcard.last_rating = None
    await db.flush()
    await db.refresh(flashcard)
    return flashcard


async def delete(db: AsyncSession, flashcard: Flashcard) -> None:
    await db.delete(flashcard)


async def apply_review(
    db: AsyncSession,
    flashcard: Flashcard,
    *,
    rating: str,
    repetitions: int,
    ease_factor: float,
    interval_days: int,
    due_at: datetime,
    reviewed_at: datetime,
) -> Flashcard:
    flashcard.repetitions = repetitions
    flashcard.ease_factor = ease_factor
    flashcard.interval_days = interval_days
    flashcard.due_at = due_at
    flashcard.last_reviewed_at = reviewed_at
    flashcard.last_rating = rating
    await db.flush()
    await db.refresh(flashcard)
    return flashcard


async def record_review(
    db: AsyncSession, *, flashcard_id: int, rating: str, quality: int, interval_days_after: int
) -> FlashcardReview:
    review = FlashcardReview(
        flashcard_id=flashcard_id,
        rating=rating,
        quality=quality,
        interval_days_after=interval_days_after,
    )
    db.add(review)
    await db.flush()
    return review


# --------------------------------------------------------------------------
# Stats
# --------------------------------------------------------------------------


async def count_total(db: AsyncSession, topic_id: int, status: str = "active") -> int:
    result = await db.execute(
        select(func.count()).select_from(Flashcard).where(
            Flashcard.topic_id == topic_id, Flashcard.status == status
        )
    )
    return result.scalar_one()


async def count_due(db: AsyncSession, topic_id: int, now: datetime) -> int:
    result = await db.execute(
        select(func.count()).select_from(Flashcard).where(
            Flashcard.topic_id == topic_id, Flashcard.status == "active", Flashcard.due_at <= now
        )
    )
    return result.scalar_one()


async def count_due_for_user(db: AsyncSession, user_id: int, now: datetime) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Flashcard)
        .join(Topic, Topic.id == Flashcard.topic_id)
        .where(Topic.user_id == user_id, Flashcard.status == "active", Flashcard.due_at <= now)
    )
    return result.scalar_one()


async def count_difficult(db: AsyncSession, topic_id: int) -> int:
    result = await db.execute(
        select(func.count()).select_from(Flashcard).where(
            Flashcard.topic_id == topic_id,
            Flashcard.status == "active",
            Flashcard.last_rating.in_(["hard", "forgot"]),
        )
    )
    return result.scalar_one()


async def count_difficult_for_user(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Flashcard)
        .join(Topic, Topic.id == Flashcard.topic_id)
        .where(
            Topic.user_id == user_id,
            Flashcard.status == "active",
            Flashcard.last_rating.in_(["hard", "forgot"]),
        )
    )
    return result.scalar_one()


async def next_due_at(db: AsyncSession, topic_id: int) -> datetime | None:
    result = await db.execute(
        select(func.min(Flashcard.due_at)).where(
            Flashcard.topic_id == topic_id, Flashcard.status == "active"
        )
    )
    return result.scalar_one_or_none()


async def next_due_at_for_user(db: AsyncSession, user_id: int) -> datetime | None:
    result = await db.execute(
        select(func.min(Flashcard.due_at))
        .select_from(Flashcard)
        .join(Topic, Topic.id == Flashcard.topic_id)
        .where(Topic.user_id == user_id, Flashcard.status == "active")
    )
    return result.scalar_one_or_none()


async def retention_for_topic(db: AsyncSession, topic_id: int) -> tuple[int, int]:
    """(total reviews, remembered reviews) -- "remembered" excludes 'forgot'."""
    result = await db.execute(
        select(
            func.count(),
            func.count().filter(FlashcardReview.rating != "forgot"),
        )
        .select_from(FlashcardReview)
        .join(Flashcard, Flashcard.id == FlashcardReview.flashcard_id)
        .where(Flashcard.topic_id == topic_id)
    )
    total, remembered = result.one()
    return total, remembered


async def retention_for_user(db: AsyncSession, user_id: int) -> tuple[int, int]:
    result = await db.execute(
        select(
            func.count(),
            func.count().filter(FlashcardReview.rating != "forgot"),
        )
        .select_from(FlashcardReview)
        .join(Flashcard, Flashcard.id == FlashcardReview.flashcard_id)
        .join(Topic, Topic.id == Flashcard.topic_id)
        .where(Topic.user_id == user_id)
    )
    total, remembered = result.one()
    return total, remembered
