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

QUESTION_TYPES = (
    "multiple_choice", "true_false", "short_answer", "fill_blank", "matching", "scenario",
)
DIFFICULTIES = ("easy", "medium", "hard", "mixed")
QUIZ_SOURCES = ("topic", "note", "document", "concept", "weak_areas")
QUIZ_STATUSES = ("draft", "published")


class Quiz(Base):
    """A generated set of questions, scoped to a topic. Re-taking it creates
    a new `QuizAttempt` each time -- the quiz itself is immutable once
    generated (matches how `Flashcard` freezes AI output at creation)."""

    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    note_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True
    )
    document_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    concept: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[str] = mapped_column(String(10), nullable=False, server_default="medium")
    adaptive: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    timed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # "draft" quizzes were generated with `preview=True` and are visible only
    # to their owner for review/editing -- attempts can't be started until
    # they're published. Existing rows (and quizzes generated without
    # `preview`) default straight to "published" to keep today's
    # generate-and-take flow unchanged.
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="published")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("char_length(trim(title)) > 0", name="quizzes_title_not_empty"),
        CheckConstraint(f"source_type IN {QUIZ_SOURCES}", name="quizzes_source_type_check"),
        CheckConstraint(f"difficulty IN {DIFFICULTIES}", name="quizzes_difficulty_check"),
        CheckConstraint(f"status IN {QUIZ_STATUSES}", name="quizzes_status_check"),
        Index("quizzes_topic_id_index", "topic_id"),
    )


class QuizQuestion(Base):
    """One question within a quiz. `options`/`correct_answer` shapes vary by
    `question_type` -- see app/modules/quizzes/grading.py for the contract."""

    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    quiz_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    concept: Mapped[str] = mapped_column(String(200), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty_score: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.5")
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[dict] = mapped_column(JSONB, nullable=False)
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
        CheckConstraint("char_length(trim(prompt)) > 0", name="quiz_questions_prompt_not_empty"),
        CheckConstraint(f"question_type IN {QUESTION_TYPES}", name="quiz_questions_type_check"),
        Index("quiz_questions_quiz_id_index", "quiz_id"),
    )


class QuizAttempt(Base):
    """One student's run through a quiz. A quiz can have many attempts over
    time, which is what powers the "compare performance over time" view."""

    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    quiz_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="in_progress")
    immediate_feedback: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    correct_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ability_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)
    ability_trace: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress','completed')", name="quiz_attempts_status_check"
        ),
        Index("quiz_attempts_quiz_id_index", "quiz_id"),
        Index("quiz_attempts_user_id_index", "user_id"),
    )


class QuizAnswer(Base):
    """A student's (graded, immediately) answer to one question within one
    attempt. One row per (attempt, question) -- resubmitting updates it."""

    __tablename__ = "quiz_answers"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False
    )
    student_answer: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    mistake_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_quiz_answers_attempt_id_question_id"),
        Index("quiz_answers_attempt_id_index", "attempt_id"),
        CheckConstraint(
            "mistake_type IS NULL OR mistake_type IN ('slip', 'partial', 'misconception', 'guess')",
            name="quiz_answers_mistake_type_check",
        ),
    )
