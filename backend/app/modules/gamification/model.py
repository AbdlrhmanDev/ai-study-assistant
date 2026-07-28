from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

XP_SOURCE_TYPES = ("quiz", "flashcard", "sparring", "mastery_milestone")


class XpEvent(Base):
    """Append-only ledger of every XP award -- the audit trail behind a
    student's level. Every entry represents evidence of learning (a correct
    answer, a recovered flashcard, a won sparring round, a mastery
    milestone); opening the app or passive viewing never creates a row."""

    __tablename__ = "xp_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="xp_events_amount_positive"),
        CheckConstraint(f"source_type IN {XP_SOURCE_TYPES}", name="xp_events_source_type_check"),
        Index("xp_events_user_id_index", "user_id"),
        Index("xp_events_user_topic_index", "user_id", "topic_id"),
    )


class UserLevel(Base):
    """One row per (user, topic): accumulated XP, from which the current
    level name (Novice -> Master) is derived at read time."""

    __tablename__ = "user_levels"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    total_xp: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_user_levels_user_id_topic_id"),
        CheckConstraint("total_xp >= 0", name="user_levels_total_xp_non_negative"),
        Index("user_levels_user_id_index", "user_id"),
    )


class UserStreak(Base):
    """One row per user: the platform-wide daily streak. Only a *graded*
    action (a quiz answer, a flashcard review, a real tutor question or
    sparring round) extends it -- never merely opening the app."""

    __tablename__ = "user_streaks"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    longest_streak: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_active_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("current_streak >= 0", name="user_streaks_current_non_negative"),
        CheckConstraint("longest_streak >= 0", name="user_streaks_longest_non_negative"),
    )
