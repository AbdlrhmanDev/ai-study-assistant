from datetime import datetime

from sqlalchemy import case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..ai.model import Document
from ..notes.model import Note
from ..topics.model import Topic
from .model import Exam, ExamAnswer, ExamAttempt, ExamQuestion


def _source_columns():
    return (
        case(
            (ExamQuestion.source_note_id.isnot(None), literal("note")),
            (ExamQuestion.source_document_id.isnot(None), literal("document")),
            else_=literal(None),
        ).label("source_type"),
        func.coalesce(Note.title, Document.title).label("source_title"),
    )


def _source_join(stmt):
    return stmt.outerjoin(Note, Note.id == ExamQuestion.source_note_id).outerjoin(
        Document, Document.id == ExamQuestion.source_document_id
    )


# --------------------------------------------------------------------------
# Exams
# --------------------------------------------------------------------------


async def create_exam(db: AsyncSession, *, topic_id: int, title: str, time_limit_seconds: int) -> Exam:
    exam = Exam(topic_id=topic_id, title=title, time_limit_seconds=time_limit_seconds)
    db.add(exam)
    await db.flush()
    await db.refresh(exam)
    return exam


async def create_question(
    db: AsyncSession,
    *,
    exam_id: int,
    order_index: int,
    question_type: str,
    blooms_level: str,
    concept: str,
    prompt: str,
    options: dict | None,
    correct_answer: dict | None,
    rubric: list | None,
    explanation: str,
    source_note_id: int | None = None,
    source_document_id: int | None = None,
) -> ExamQuestion:
    question = ExamQuestion(
        exam_id=exam_id, order_index=order_index, question_type=question_type, blooms_level=blooms_level,
        concept=concept, prompt=prompt, options=options, correct_answer=correct_answer, rubric=rubric,
        explanation=explanation, source_note_id=source_note_id, source_document_id=source_document_id,
    )
    db.add(question)
    await db.flush()
    return question


async def get_exam_by_id(db: AsyncSession, exam_id: int) -> Exam | None:
    return await db.get(Exam, exam_id)


async def get_exam_for_user(db: AsyncSession, exam_id: int, user_id: int) -> Exam | None:
    stmt = (
        select(Exam)
        .join(Topic, Topic.id == Exam.topic_id)
        .where(Exam.id == exam_id, Topic.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_by_topic(db: AsyncSession, topic_id: int) -> list[Exam]:
    stmt = select(Exam).where(Exam.topic_id == topic_id).order_by(Exam.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_by_topic_for_user(db: AsyncSession, user_id: int) -> dict[int, int]:
    """Return every owned topic's exam count without per-topic queries."""
    stmt = (
        select(Topic.id, func.count(Exam.id))
        .outerjoin(Exam, Exam.topic_id == Topic.id)
        .where(Topic.user_id == user_id)
        .group_by(Topic.id)
    )
    result = await db.execute(stmt)
    return {topic_id: count for topic_id, count in result.all()}


async def count_questions_by_exam_ids(db: AsyncSession, exam_ids: list[int]) -> dict[int, int]:
    if not exam_ids:
        return {}
    stmt = (
        select(ExamQuestion.exam_id, func.count())
        .where(ExamQuestion.exam_id.in_(exam_ids))
        .group_by(ExamQuestion.exam_id)
    )
    result = await db.execute(stmt)
    return {exam_id: count for exam_id, count in result.all()}


async def delete_exam(db: AsyncSession, exam: Exam) -> None:
    await db.delete(exam)


# --------------------------------------------------------------------------
# Questions
# --------------------------------------------------------------------------


async def list_questions_by_exam(
    db: AsyncSession, exam_id: int
) -> list[tuple[ExamQuestion, str | None, str | None]]:
    stmt = (
        _source_join(select(ExamQuestion, *_source_columns()).select_from(ExamQuestion))
        .where(ExamQuestion.exam_id == exam_id)
        .order_by(ExamQuestion.order_index)
    )
    result = await db.execute(stmt)
    return [(row.ExamQuestion, row.source_type, row.source_title) for row in result]


async def get_question_for_exam(
    db: AsyncSession, question_id: int, exam_id: int
) -> tuple[ExamQuestion, str | None, str | None] | None:
    stmt = (
        _source_join(select(ExamQuestion, *_source_columns()).select_from(ExamQuestion))
        .where(ExamQuestion.id == question_id, ExamQuestion.exam_id == exam_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return row.ExamQuestion, row.source_type, row.source_title


# --------------------------------------------------------------------------
# Attempts + answers
# --------------------------------------------------------------------------


async def create_attempt(
    db: AsyncSession, *, exam_id: int, user_id: int, deadline_at: datetime
) -> ExamAttempt:
    attempt = ExamAttempt(exam_id=exam_id, user_id=user_id, deadline_at=deadline_at)
    db.add(attempt)
    await db.flush()
    await db.refresh(attempt)
    return attempt


async def get_attempt_for_user(db: AsyncSession, attempt_id: int, user_id: int) -> ExamAttempt | None:
    stmt = select(ExamAttempt).where(ExamAttempt.id == attempt_id, ExamAttempt.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_answer(
    db: AsyncSession, *, attempt_id: int, question_id: int, student_answer: dict,
    is_correct: bool | None, points_earned: float | None, points_possible: float,
) -> ExamAnswer:
    stmt = (
        pg_insert(ExamAnswer)
        .values(
            attempt_id=attempt_id, question_id=question_id, student_answer=student_answer,
            is_correct=is_correct, points_earned=points_earned, points_possible=points_possible,
        )
        .on_conflict_do_update(
            index_elements=[ExamAnswer.attempt_id, ExamAnswer.question_id],
            set_={
                "student_answer": student_answer, "is_correct": is_correct,
                "points_earned": points_earned, "points_possible": points_possible,
                "answered_at": func.now(),
            },
        )
        .returning(ExamAnswer)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.scalar_one()


async def list_answers_for_attempt(db: AsyncSession, attempt_id: int) -> list[ExamAnswer]:
    stmt = select(ExamAnswer).where(ExamAnswer.attempt_id == attempt_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def set_answer_grading(
    db: AsyncSession, answer: ExamAnswer, *, criteria_scores: list, points_earned: float, points_possible: float
) -> ExamAnswer:
    answer.criteria_scores = criteria_scores
    answer.points_earned = points_earned
    answer.points_possible = points_possible
    await db.flush()
    return answer


async def complete_attempt(
    db: AsyncSession, attempt: ExamAttempt, *, completed_at: datetime, score: float, score_breakdown: list,
) -> ExamAttempt:
    attempt.status = "completed"
    attempt.completed_at = completed_at
    attempt.score = score
    attempt.score_breakdown = score_breakdown
    await db.flush()
    await db.refresh(attempt)
    return attempt


async def list_attempts_for_exam(db: AsyncSession, exam_id: int, user_id: int) -> list[ExamAttempt]:
    stmt = (
        select(ExamAttempt)
        .where(ExamAttempt.exam_id == exam_id, ExamAttempt.user_id == user_id)
        .order_by(ExamAttempt.started_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def latest_completed_attempts(
    db: AsyncSession, exam_ids: list[int], user_id: int
) -> dict[int, ExamAttempt]:
    if not exam_ids:
        return {}
    stmt = (
        select(ExamAttempt)
        .distinct(ExamAttempt.exam_id)
        .where(
            ExamAttempt.exam_id.in_(exam_ids),
            ExamAttempt.user_id == user_id,
            ExamAttempt.status == "completed",
        )
        .order_by(ExamAttempt.exam_id, ExamAttempt.completed_at.desc())
    )
    result = await db.execute(stmt)
    return {attempt.exam_id: attempt for attempt in result.scalars().all()}
