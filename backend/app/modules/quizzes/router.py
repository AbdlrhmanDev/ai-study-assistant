from fastapi import APIRouter, Header, status

from ...api.dependencies import CurrentUser, DbSession
from ...core.idempotency import with_idempotency
from ...shared.responses import no_content
from . import service
from .model import Quiz, QuizQuestion
from .schema import AnswerSubmit, AttemptStart, QuizGenerate, QuizOut

router = APIRouter(tags=["quizzes"])


def _serialize_quiz(quiz: Quiz) -> dict:
    return QuizOut.model_validate(quiz).model_dump(mode="json")


def _serialize_question_for_taking(entry: tuple[QuizQuestion, str | None, str | None]) -> dict:
    question, _source_type, _source_title = entry
    return {
        "id": question.id,
        "orderIndex": question.order_index,
        "questionType": question.question_type,
        "concept": question.concept,
        "prompt": question.prompt,
        "options": question.options,
        "difficultyScore": question.difficulty_score,
    }


@router.get("/quizzes/counts-by-topic")
async def count_quizzes_by_topic(db: DbSession, user: CurrentUser):
    counts = await service.count_quizzes_by_topic(db, user["id"])
    return {"counts": counts}


@router.get("/topics/{topic_id}/quizzes")
async def list_quizzes(topic_id: int, db: DbSession, user: CurrentUser):
    entries = await service.list_quizzes(db, topic_id, user["id"])
    return {
        "quizzes": [
            {
                **_serialize_quiz(entry["quiz"]),
                "questionCount": entry["questionCount"],
                "latestAttempt": service.serialize_attempt(entry["latestAttempt"]) if entry["latestAttempt"] else None,
            }
            for entry in entries
        ]
    }


@router.post("/topics/{topic_id}/quizzes/generate", status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    topic_id: int, payload: QuizGenerate, db: DbSession, user: CurrentUser,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    async def _compute() -> dict:
        quiz, questions = await service.generate_quiz(db, topic_id, user["id"], payload)
        return {
            "quiz": _serialize_quiz(quiz),
            "questions": [_serialize_question_for_taking(entry) for entry in questions],
        }

    return await with_idempotency(user["id"], "quiz_generate", idempotency_key, _compute)


@router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: int, db: DbSession, user: CurrentUser):
    quiz, questions = await service.get_quiz_for_taking(db, quiz_id, user["id"])
    return {
        "quiz": _serialize_quiz(quiz),
        "questions": [_serialize_question_for_taking(entry) for entry in questions],
    }


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(quiz_id: int, db: DbSession, user: CurrentUser):
    await service.delete_quiz(db, quiz_id, user["id"])
    return no_content()


@router.get("/quizzes/{quiz_id}/attempts")
async def list_attempts(quiz_id: int, db: DbSession, user: CurrentUser):
    attempts = await service.list_attempts(db, quiz_id, user["id"])
    return {"attempts": [service.serialize_attempt(attempt) for attempt in attempts]}


@router.post("/quizzes/{quiz_id}/attempts", status_code=status.HTTP_201_CREATED)
async def start_attempt(quiz_id: int, payload: AttemptStart, db: DbSession, user: CurrentUser):
    attempt = await service.start_attempt(db, quiz_id, user["id"], payload.immediateFeedback)
    return {"attempt": service.serialize_attempt(attempt)}


@router.post("/quizzes/attempts/{attempt_id}/answers")
async def submit_answer(attempt_id: int, payload: AnswerSubmit, db: DbSession, user: CurrentUser):
    return await service.submit_answer(db, attempt_id, user["id"], payload.questionId, payload.answer)


@router.get("/quizzes/attempts/{attempt_id}/questions/{question_id}/diagnosis")
async def get_answer_diagnosis(attempt_id: int, question_id: int, db: DbSession, user: CurrentUser):
    return await service.get_answer_diagnosis(db, attempt_id, question_id, user["id"])


@router.post("/quizzes/attempts/{attempt_id}/questions/{question_id}/drill", status_code=status.HTTP_201_CREATED)
async def drill_answer(attempt_id: int, question_id: int, db: DbSession, user: CurrentUser):
    return await service.drill_answer(db, attempt_id, question_id, user["id"])


@router.post("/quizzes/attempts/{attempt_id}/complete")
async def complete_attempt(attempt_id: int, db: DbSession, user: CurrentUser):
    return await service.complete_attempt(db, attempt_id, user["id"])


@router.get("/quizzes/attempts/{attempt_id}")
async def get_attempt(attempt_id: int, db: DbSession, user: CurrentUser):
    return await service.get_attempt_results(db, attempt_id, user["id"])
