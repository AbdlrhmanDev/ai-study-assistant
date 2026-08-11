from datetime import datetime

from sqlalchemy import case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..ai.model import Document
from ..notes.model import Note
from ..topics.model import Topic
from .model import Quiz, QuizAnswer, QuizAttempt, QuizQuestion

# --------------------------------------------------------------------------
# Source (note/document) join -- mirrors ai/repository.py's
# `_chunk_source_join` and flashcards/repository.py's `_source_join`.
# --------------------------------------------------------------------------


def _source_columns():
    return (
        case(
            (QuizQuestion.source_note_id.isnot(None), literal("note")),
            (QuizQuestion.source_document_id.isnot(None), literal("document")),
            else_=literal(None),
        ).label("source_type"),
        func.coalesce(Note.title, Document.title).label("source_title"),
    )


def _source_join(stmt):
    return stmt.outerjoin(Note, Note.id == QuizQuestion.source_note_id).outerjoin(
        Document, Document.id == QuizQuestion.source_document_id
    )


# --------------------------------------------------------------------------
# Quizzes
# --------------------------------------------------------------------------


async def create_quiz(
    db: AsyncSession,
    *,
    topic_id: int,
    title: str,
    source_type: str,
    difficulty: str,
    timed: bool,
    time_limit_seconds: int | None,
    note_id: int | None = None,
    document_id: int | None = None,
    concept: str | None = None,
    adaptive: bool = False,
) -> Quiz:
    quiz = Quiz(
        topic_id=topic_id, title=title, source_type=source_type, difficulty=difficulty,
        timed=timed, time_limit_seconds=time_limit_seconds, adaptive=adaptive,
        note_id=note_id, document_id=document_id, concept=concept,
    )
    db.add(quiz)
    await db.flush()
    await db.refresh(quiz)
    return quiz


async def create_question(
    db: AsyncSession,
    *,
    quiz_id: int,
    order_index: int,
    question_type: str,
    concept: str,
    prompt: str,
    options: dict | None,
    correct_answer: dict,
    explanation: str,
    source_note_id: int | None = None,
    source_document_id: int | None = None,
    difficulty_score: float = 0.5,
) -> QuizQuestion:
    question = QuizQuestion(
        quiz_id=quiz_id, order_index=order_index, question_type=question_type, concept=concept,
        prompt=prompt, options=options, correct_answer=correct_answer, explanation=explanation,
        source_note_id=source_note_id, source_document_id=source_document_id,
        difficulty_score=difficulty_score,
    )
    db.add(question)
    await db.flush()
    return question


async def get_quiz_by_id(db: AsyncSession, quiz_id: int) -> Quiz | None:
    return await db.get(Quiz, quiz_id)


async def get_quiz_for_user(db: AsyncSession, quiz_id: int, user_id: int) -> Quiz | None:
    stmt = (
        select(Quiz)
        .join(Topic, Topic.id == Quiz.topic_id)
        .where(Quiz.id == quiz_id, Topic.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_by_topic(db: AsyncSession, topic_id: int) -> list[Quiz]:
    stmt = select(Quiz).where(Quiz.topic_id == topic_id).order_by(Quiz.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_by_topic_for_user(db: AsyncSession, user_id: int) -> dict[int, int]:
    """Return every owned topic's quiz count in one database round trip."""
    stmt = (
        select(Topic.id, func.count(Quiz.id))
        .outerjoin(Quiz, Quiz.topic_id == Topic.id)
        .where(Topic.user_id == user_id)
        .group_by(Topic.id)
    )
    result = await db.execute(stmt)
    return {topic_id: count for topic_id, count in result.all()}


async def count_questions_by_quiz_ids(db: AsyncSession, quiz_ids: list[int]) -> dict[int, int]:
    if not quiz_ids:
        return {}
    stmt = (
        select(QuizQuestion.quiz_id, func.count())
        .where(QuizQuestion.quiz_id.in_(quiz_ids))
        .group_by(QuizQuestion.quiz_id)
    )
    result = await db.execute(stmt)
    return {quiz_id: count for quiz_id, count in result.all()}


async def latest_completed_attempts(
    db: AsyncSession, quiz_ids: list[int], user_id: int
) -> dict[int, QuizAttempt]:
    if not quiz_ids:
        return {}
    stmt = (
        select(QuizAttempt)
        .distinct(QuizAttempt.quiz_id)
        .where(
            QuizAttempt.quiz_id.in_(quiz_ids),
            QuizAttempt.user_id == user_id,
            QuizAttempt.status == "completed",
        )
        .order_by(QuizAttempt.quiz_id, QuizAttempt.completed_at.desc())
    )
    result = await db.execute(stmt)
    return {attempt.quiz_id: attempt for attempt in result.scalars().all()}


async def delete_quiz(db: AsyncSession, quiz: Quiz) -> None:
    await db.delete(quiz)


# --------------------------------------------------------------------------
# Questions
# --------------------------------------------------------------------------


async def list_questions_by_quiz(
    db: AsyncSession, quiz_id: int
) -> list[tuple[QuizQuestion, str | None, str | None]]:
    stmt = (
        _source_join(select(QuizQuestion, *_source_columns()).select_from(QuizQuestion))
        .where(QuizQuestion.quiz_id == quiz_id)
        .order_by(QuizQuestion.order_index)
    )
    result = await db.execute(stmt)
    return [(row.QuizQuestion, row.source_type, row.source_title) for row in result]


async def get_question_for_quiz(
    db: AsyncSession, question_id: int, quiz_id: int
) -> tuple[QuizQuestion, str | None, str | None] | None:
    stmt = (
        _source_join(select(QuizQuestion, *_source_columns()).select_from(QuizQuestion))
        .where(QuizQuestion.id == question_id, QuizQuestion.quiz_id == quiz_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return row.QuizQuestion, row.source_type, row.source_title


# --------------------------------------------------------------------------
# Attempts + answers
# --------------------------------------------------------------------------


async def create_attempt(
    db: AsyncSession, *, quiz_id: int, user_id: int, immediate_feedback: bool
) -> QuizAttempt:
    attempt = QuizAttempt(quiz_id=quiz_id, user_id=user_id, immediate_feedback=immediate_feedback)
    db.add(attempt)
    await db.flush()
    await db.refresh(attempt)
    return attempt


async def update_ability(
    db: AsyncSession, attempt: QuizAttempt, *, ability_estimate: float, trace_entry: dict
) -> QuizAttempt:
    attempt.ability_estimate = ability_estimate
    attempt.ability_trace = [*(attempt.ability_trace or []), trace_entry]
    await db.flush()
    return attempt


async def get_attempt_for_user(db: AsyncSession, attempt_id: int, user_id: int) -> QuizAttempt | None:
    stmt = select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_answer(
    db: AsyncSession, *, attempt_id: int, question_id: int, student_answer: dict, is_correct: bool
) -> QuizAnswer:
    stmt = (
        pg_insert(QuizAnswer)
        .values(
            attempt_id=attempt_id, question_id=question_id,
            student_answer=student_answer, is_correct=is_correct,
        )
        .on_conflict_do_update(
            index_elements=[QuizAnswer.attempt_id, QuizAnswer.question_id],
            set_={
                "student_answer": student_answer,
                "is_correct": is_correct,
                "answered_at": func.now(),
            },
        )
        .returning(QuizAnswer)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.scalar_one()


async def list_answers_for_attempt(db: AsyncSession, attempt_id: int) -> list[QuizAnswer]:
    stmt = select(QuizAnswer).where(QuizAnswer.attempt_id == attempt_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_answer_by_question(db: AsyncSession, attempt_id: int, question_id: int) -> QuizAnswer | None:
    stmt = select(QuizAnswer).where(
        QuizAnswer.attempt_id == attempt_id, QuizAnswer.question_id == question_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def save_diagnosis(db: AsyncSession, answer: QuizAnswer, *, mistake_type: str, diagnosis: str) -> QuizAnswer:
    answer.mistake_type = mistake_type
    answer.diagnosis = diagnosis
    await db.flush()
    await db.refresh(answer)
    return answer


async def complete_attempt(
    db: AsyncSession,
    attempt: QuizAttempt,
    *,
    completed_at: datetime,
    time_spent_seconds: int,
    score: float,
    correct_count: int,
    total_count: int,
) -> QuizAttempt:
    attempt.status = "completed"
    attempt.completed_at = completed_at
    attempt.time_spent_seconds = time_spent_seconds
    attempt.score = score
    attempt.correct_count = correct_count
    attempt.total_count = total_count
    await db.flush()
    await db.refresh(attempt)
    return attempt


async def list_attempts_for_quiz(db: AsyncSession, quiz_id: int, user_id: int) -> list[QuizAttempt]:
    stmt = (
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.started_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_incorrect_concepts_for_topic(
    db: AsyncSession, topic_id: int, user_id: int
) -> list[str]:
    """Distinct concepts the student has gotten wrong at least once in this
    topic -- feeds the "previously incorrect questions" / weak-areas
    follow-up quiz generation source."""
    stmt = (
        select(QuizQuestion.concept)
        .distinct()
        .join(Quiz, Quiz.id == QuizQuestion.quiz_id)
        .join(QuizAnswer, QuizAnswer.question_id == QuizQuestion.id)
        .join(QuizAttempt, QuizAttempt.id == QuizAnswer.attempt_id)
        .where(Quiz.topic_id == topic_id, QuizAttempt.user_id == user_id, QuizAnswer.is_correct.is_(False))
    )
    result = await db.execute(stmt)
    return [concept for (concept,) in result.all()]
