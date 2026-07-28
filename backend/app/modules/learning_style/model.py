from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Identity, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

AXES = ("visual", "reading", "practice", "flashcards", "examples", "conversation")


class LearningStyleProfile(Base):
    """One row per user: a 6-axis modality profile inferred from engagement
    behavior (never a self-report survey). Weights always sum to ~1.0."""

    __tablename__ = "learning_style_profile"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    visual: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.1667")
    reading: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.1667")
    practice: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.1667")
    flashcards: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.1667")
    examples: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.1665")
    conversation: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.1667")
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    overridden: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("visual >= 0 AND visual <= 1", name="learning_style_visual_range"),
        CheckConstraint("reading >= 0 AND reading <= 1", name="learning_style_reading_range"),
        CheckConstraint("practice >= 0 AND practice <= 1", name="learning_style_practice_range"),
        CheckConstraint("flashcards >= 0 AND flashcards <= 1", name="learning_style_flashcards_range"),
        CheckConstraint("examples >= 0 AND examples <= 1", name="learning_style_examples_range"),
        CheckConstraint("conversation >= 0 AND conversation <= 1", name="learning_style_conversation_range"),
    )
