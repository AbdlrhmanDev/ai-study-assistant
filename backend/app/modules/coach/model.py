from __future__ import annotations

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
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

TASK_STATUSES = ("pending", "completed", "skipped")


class StudyGoal(Base):
    """A student's per-topic exam date and daily study budget -- the only
    input the Coach needs beyond mastery data already tracked elsewhere."""

    __tablename__ = "study_goals"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    available_minutes_per_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_study_goals_user_id_topic_id"),
        CheckConstraint(
            "available_minutes_per_day IS NULL OR available_minutes_per_day > 0",
            name="study_goals_minutes_positive",
        ),
    )


class StudyPlan(Base):
    """One row per (user, day): the day's generated plan. `narrative` is a
    short LLM-phrased framing sentence -- never the source of truth for
    *which* tasks exist, only how they're introduced."""

    __tablename__ = "study_plans"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "plan_date", name="uq_study_plans_user_id_plan_date"),
        Index("study_plans_user_id_index", "user_id"),
    )


class StudyPlanTask(Base):
    """One ranked, time-boxed task within a day's plan, pointing back at the
    concept (and topic) it targets."""

    __tablename__ = "study_plan_tasks"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    plan_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    concept_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("concepts.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"status IN {TASK_STATUSES}", name="study_plan_tasks_status_check"),
        Index("study_plan_tasks_plan_id_index", "plan_id"),
    )
