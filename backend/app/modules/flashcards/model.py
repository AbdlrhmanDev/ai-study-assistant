from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

DEFAULT_EASE_FACTOR = 2.5


class Flashcard(Base):
    """A spaced-repetition study card, optionally traced back to the note or
    document it was generated from (manual cards have neither)."""

    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    note_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True
    )
    document_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    concept: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )  # feeds Weakness Detection; nullable since manual cards may not set one
    origin: Mapped[str] = mapped_column(String(10), nullable=False, server_default="manual")
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="active")

    # Spaced-repetition state (SM-2). New cards are due immediately.
    repetitions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ease_factor: Mapped[float] = mapped_column(
        Float, nullable=False, server_default=str(DEFAULT_EASE_FACTOR)
    )
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    due_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_rating: Mapped[str | None] = mapped_column(String(10), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("char_length(trim(question)) > 0", name="flashcards_question_not_empty"),
        CheckConstraint("char_length(trim(answer)) > 0", name="flashcards_answer_not_empty"),
        CheckConstraint("origin IN ('manual','ai')", name="flashcards_origin_check"),
        CheckConstraint("status IN ('active','archived')", name="flashcards_status_check"),
        CheckConstraint(
            "last_rating IS NULL OR last_rating IN ('easy','medium','hard','forgot')",
            name="flashcards_last_rating_check",
        ),
        Index("flashcards_topic_id_index", "topic_id"),
        Index("flashcards_note_id_index", "note_id"),
        Index("flashcards_document_id_index", "document_id"),
        Index("flashcards_topic_due_at_index", "topic_id", "due_at"),
    )


class FlashcardReview(Base):
    """Append-only review history, used to compute retention-rate stats."""

    __tablename__ = "flashcard_reviews"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    flashcard_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[str] = mapped_column(String(10), nullable=False)
    quality: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_days_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "rating IN ('easy','medium','hard','forgot')", name="flashcard_reviews_rating_check"
        ),
        Index("flashcard_reviews_flashcard_id_index", "flashcard_id"),
    )
