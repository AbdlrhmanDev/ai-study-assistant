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


async def set_quiz_status(db: AsyncSession, quiz: Quiz, *, status: str) -> Quiz:
    quiz.status = status
    await db.flush()
    await db.refresh(quiz)
    return quiz


async def list_existing_prompts_for_topic(db: AsyncSession, topic_id: int, limit: int = 150) -> list[str]:
    """A bounded sample of this topic's already-asked question prompts --
    fed back into the generation prompt so the AI avoids repeating them."""
    stmt = (
        select(QuizQuestion.prompt)
        .join(Quiz, Quiz.id == QuizQuestion.quiz_id)
        .where(Quiz.topic_id == topic_id)
        .order_by(QuizQuestion.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [prompt for (prompt,) in result.all()]


async def question_analytics(db: AsyncSession, quiz_id: int) -> list[dict]:
    """Per-question stats across every attempt at this quiz -- how often
    each item was answered and how often it was answered correctly."""
    stmt = (
        select(
            QuizQuestion.id,
            QuizQuestion.order_index,
            QuizQuestion.prompt,
            QuizQuestion.concept,
            func.count(QuizAnswer.id).label("times_answered"),
            func.sum(case((QuizAnswer.is_correct.is_(True), 1), else_=0)).label("correct_count"),
        )
        .outerjoin(QuizAnswer, QuizAnswer.question_id == QuizQuestion.id)
        .where(QuizQuestion.quiz_id == quiz_id)
        .group_by(QuizQuestion.id, QuizQuestion.order_index)
        .order_by(QuizQuestion.order_index)
    )
    result = await db.execute(stmt)
    return [
        {
            "questionId": row.id,
            "prompt": row.prompt,
            "concept": row.concept,
            "timesAnswered": row.times_answered,
            "correctCount": int(row.correct_count or 0),
        }
        for row in result
    ]


async def topic_question_stats(
    db: AsyncSession, topic_id: int, user_id: int
) -> list[dict]:
    """Per-question accuracy across *this user's* attempts on every quiz in a
    topic -- the raw material for difficulty calibration (does the stored
    difficulty estimate match how often the question is actually answered
    correctly?)."""
    stmt = (
        select(
            QuizQuestion.id,
            QuizQuestion.order_index,
            QuizQuestion.prompt,
            QuizQuestion.concept,
            QuizQuestion.question_type,
            QuizQuestion.difficulty_score,
            func.count(QuizAnswer.id).label("times_answered"),
            func.sum(case((QuizAnswer.is_correct.is_(True), 1), else_=0)).label("correct_count"),
        )
        .join(Quiz, Quiz.id == QuizQuestion.quiz_id)
        .join(QuizAttempt, QuizAttempt.quiz_id == Quiz.id)
        .join(
            QuizAnswer,
            (QuizAnswer.attempt_id == QuizAttempt.id) & (QuizAnswer.question_id == QuizQuestion.id),
        )
        .where(Quiz.topic_id == topic_id, QuizAttempt.user_id == user_id)
        .group_by(QuizQuestion.id, QuizQuestion.order_index)
        .order_by(QuizQuestion.order_index)
    )
    result = await db.execute(stmt)
    return [
        {
            "questionId": row.id,
            "prompt": row.prompt,
            "concept": row.concept,
            "questionType": row.question_type,
            "assignedDifficulty": row.difficulty_score,
            "timesAnswered": row.times_answered,
            "correctCount": int(row.correct_count or 0),
        }
        for row in result
    ]


async def per_question_answer_times(
    db: AsyncSession, topic_id: int, user_id: int
) -> dict[int, list[float]]:
    """Seconds spent per question, derived from the gap between consecutive
    answers inside each of the user's attempts on quizzes in a topic (the
    first answer of an attempt is measured from `started_at`)."""
    attempts_rows = await db.execute(
        select(QuizAttempt.id, QuizAttempt.started_at)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(Quiz.topic_id == topic_id, QuizAttempt.user_id == user_id)
    )
    starts = {attempt_id: started_at for attempt_id, started_at in attempts_rows.all()}

    answers_rows = await db.execute(
        select(QuizAnswer.attempt_id, QuizAnswer.question_id, QuizAnswer.answered_at)
        .join(QuizAttempt, QuizAttempt.id == QuizAnswer.attempt_id)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .where(Quiz.topic_id == topic_id, QuizAttempt.user_id == user_id)
        .order_by(QuizAnswer.attempt_id, QuizAnswer.answered_at)
    )
    rows = answers_rows.all()

    times: dict[int, list[float]] = {}
    previous_per_attempt: dict[int, datetime] = {}
    for attempt_id, question_id, answered_at in rows:
        previous = previous_per_attempt.get(attempt_id, starts.get(attempt_id))
        if previous is not None:
            times.setdefault(question_id, []).append(max((answered_at - previous).total_seconds(), 0))
        previous_per_attempt[attempt_id] = answered_at
    return times


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


async def update_question(
    db: AsyncSession,
    question: QuizQuestion,
    *,
    prompt: str | None = None,
    explanation: str | None = None,
    concept: str | None = None,
    options: dict | None = None,
    correct_answer: dict | None = None,
    update_answer_shape: bool = False,
    difficulty_score: float | None = None,
    source_note_id: int | None = None,
    source_document_id: int | None = None,
    update_source: bool = False,
) -> QuizQuestion:
    if prompt is not None:
        question.prompt = prompt
    if explanation is not None:
        question.explanation = explanation
    if concept is not None:
        question.concept = concept
    if update_answer_shape:
        question.options = options
        question.correct_answer = correct_answer
    if difficulty_score is not None:
        question.difficulty_score = difficulty_score
    if update_source:
        question.source_note_id = source_note_id
        question.source_document_id = source_document_id
    await db.flush()
    await db.refresh(question)
    return question


async def delete_question(db: AsyncSession, question: QuizQuestion) -> None:
    await db.delete(question)


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
