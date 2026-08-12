from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

EXAM_QUESTION_TYPES = ("multiple_choice", "true_false", "short_answer", "essay", "case_study", "coding")
RUBRIC_QUESTION_TYPES = ("essay", "case_study", "coding")
BLOOMS_LEVELS = ("remember", "understand", "apply", "analyze", "evaluate", "create")


class Exam(Base):
    """A generated, formally timed exam -- unlike a practice Quiz, always
    has a server-enforced time limit and may include rubric-graded
    open-ended questions."""

    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="published")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("char_length(trim(title)) > 0", name="exams_title_not_empty"),
        CheckConstraint("time_limit_seconds > 0", name="exams_time_limit_positive"),
        CheckConstraint("status IN ('draft', 'published')", name="exams_status_check"),
        Index("exams_topic_id_index", "topic_id"),
    )


class ExamQuestion(Base):
    """One question within an exam. Objective types (multiple_choice /
    true_false / short_answer) carry `correct_answer` and grade
    deterministically (reusing quizzes/grading.py). Rubric types (essay /
    case_study / coding) carry `rubric` instead and are graded by an LLM
    against it, never against `correct_answer`."""

    __tablename__ = "exam_questions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    exam_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    blooms_level: Mapped[str] = mapped_column(String(20), nullable=False)
    concept: Mapped[str] = mapped_column(String(200), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rubric: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    source_note_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True
    )
    source_document_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("char_length(trim(prompt)) > 0", name="exam_questions_prompt_not_empty"),
        CheckConstraint(f"question_type IN {EXAM_QUESTION_TYPES}", name="exam_questions_type_check"),
        CheckConstraint(f"blooms_level IN {BLOOMS_LEVELS}", name="exam_questions_blooms_check"),
        Index("exam_questions_exam_id_index", "exam_id"),
    )


class ExamAttempt(Base):
    """One student's timed sitting of an exam. `deadline_at` is computed at
    start time and is the sole source of truth for expiry -- the client's
    countdown is a display only, never trusted for grading."""

    __tablename__ = "exam_attempts"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    exam_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="in_progress")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_breakdown: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("status IN ('in_progress', 'completed')", name="exam_attempts_status_check"),
        Index("exam_attempts_exam_id_index", "exam_id"),
        Index("exam_attempts_user_id_index", "user_id"),
    )


class ExamAnswer(Base):
    """A student's answer to one question within one attempt. Objective
    types are graded (is_correct + points) immediately on submit; rubric
    types are graded in a batch at attempt-submit time, so `is_correct` and
    `criteria_scores` stay null until then."""

    __tablename__ = "exam_answers"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False
    )
    student_answer: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    criteria_scores: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    points_earned: Mapped[float | None] = mapped_column(Float, nullable=True)
    points_possible: Mapped[float] = mapped_column(Float, nullable=False, server_default="1")
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_exam_answers_attempt_id_question_id"),
        Index("exam_answers_attempt_id_index", "attempt_id"),
    )
