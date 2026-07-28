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
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

MASTERY_SOURCE_TYPES = ("quiz", "exam", "flashcard", "sparring")
DEFAULT_DECAY_RATE = 0.02  # per day; ~50% decay over ~35 days without review


class Concept(Base):
    """A canonical concept within a topic, resolved by (topic_id, name) --
    quiz/flashcard generation tags content with a free-text concept label,
    which gets matched or created here so mastery can be tracked per concept
    rather than per quiz/deck."""

    __tablename__ = "concepts"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("char_length(trim(name)) > 0", name="concepts_name_not_empty"),
        Index("concepts_topic_id_index", "topic_id"),
    )


class ConceptMastery(Base):
    """One row per (user, concept): current mastery state. `mastery_score`
    is the value as of `last_assessed_at` -- callers apply exponential decay
    at read time (see mastery/scoring.py) rather than storing a live number,
    so forgetting is always computed against "now", not the last write."""

    __tablename__ = "concept_mastery"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    concept_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False
    )
    mastery_score: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    decay_rate: Mapped[float] = mapped_column(Float, nullable=False, server_default=str(DEFAULT_DECAY_RATE))
    last_assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "concept_id", name="uq_concept_mastery_user_id_concept_id"),
        Index("concept_mastery_user_id_index", "user_id"),
        Index("concept_mastery_concept_id_index", "concept_id"),
    )


class MasteryEvent(Base):
    """Append-only signal that moved a mastery score -- the audit trail
    behind "why is this concept marked weak"."""

    __tablename__ = "mastery_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    concept_mastery_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("concept_mastery.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    quality: Mapped[float] = mapped_column(Float, nullable=False)
    delta: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"source_type IN {MASTERY_SOURCE_TYPES}", name="mastery_events_source_type_check"),
        CheckConstraint("quality >= 0 AND quality <= 1", name="mastery_events_quality_range_check"),
        Index("mastery_events_concept_mastery_id_index", "concept_mastery_id"),
    )
