from fastapi import APIRouter, Header, status

from ...api.dependencies import CurrentUser, DbSession
from ...core.idempotency import with_idempotency
from ...shared.responses import no_content
from . import service
from .model import Exam, ExamQuestion
from .schema import ExamAnswerSubmit, ExamGenerate

router = APIRouter(tags=["exams"])


def _serialize_exam(exam: Exam) -> dict:
    return {
        "id": exam.id,
        "topicId": exam.topic_id,
        "title": exam.title,
        "timeLimitSeconds": exam.time_limit_seconds,
        "createdAt": exam.created_at.isoformat(),
    }


def _serialize_attempt_summary(attempt) -> dict | None:
    if attempt is None:
        return None
    return {
        "id": attempt.id,
        "examId": attempt.exam_id,
        "status": attempt.status,
        "startedAt": attempt.started_at.isoformat(),
        "completedAt": attempt.completed_at.isoformat() if attempt.completed_at else None,
        "score": attempt.score,
    }


def _serialize_question_for_taking(entry: tuple[ExamQuestion, str | None, str | None]) -> dict:
    question, _source_type, _source_title = entry
    return {
        "id": question.id,
        "orderIndex": question.order_index,
        "questionType": question.question_type,
        "bloomsLevel": question.blooms_level,
        "concept": question.concept,
        "prompt": question.prompt,
        "options": question.options,
    }


@router.get("/exams/counts-by-topic")
async def count_exams_by_topic(db: DbSession, user: CurrentUser):
    counts = await service.count_exams_by_topic(db, user["id"])
    return {"counts": counts}


@router.get("/topics/{topic_id}/exams")
async def list_exams(topic_id: int, db: DbSession, user: CurrentUser):
    entries = await service.list_exams(db, topic_id, user["id"])
    return {
        "exams": [
            {
                **_serialize_exam(entry["exam"]),
                "questionCount": entry["questionCount"],
                "latestAttempt": _serialize_attempt_summary(entry["latestAttempt"]),
            }
            for entry in entries
        ]
    }


@router.post("/topics/{topic_id}/exams/generate", status_code=status.HTTP_201_CREATED)
async def generate_exam(
    topic_id: int, payload: ExamGenerate, db: DbSession, user: CurrentUser,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    async def _compute() -> dict:
        exam, questions = await service.generate_exam(db, topic_id, user["id"], payload)
        return {
            "exam": _serialize_exam(exam),
            "questions": [_serialize_question_for_taking(entry) for entry in questions],
        }

    return await with_idempotency(user["id"], "exam_generate", idempotency_key, _compute)


@router.get("/exams/{exam_id}")
async def get_exam(exam_id: int, db: DbSession, user: CurrentUser):
    exam, questions = await service.get_exam_for_taking(db, exam_id, user["id"])
    return {
        "exam": _serialize_exam(exam),
        "questions": [_serialize_question_for_taking(entry) for entry in questions],
    }


@router.delete("/exams/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(exam_id: int, db: DbSession, user: CurrentUser):
    await service.delete_exam(db, exam_id, user["id"])
    return no_content()


@router.get("/exams/{exam_id}/attempts")
async def list_attempts(exam_id: int, db: DbSession, user: CurrentUser):
    attempts = await service.list_attempts(db, exam_id, user["id"])
    return {"attempts": [_serialize_attempt_summary(attempt) for attempt in attempts]}


@router.post("/exams/{exam_id}/attempts", status_code=status.HTTP_201_CREATED)
async def start_attempt(exam_id: int, db: DbSession, user: CurrentUser):
    attempt = await service.start_attempt(db, exam_id, user["id"])
    return {"attempt": _serialize_attempt_summary(attempt), "deadlineAt": attempt.deadline_at.isoformat()}


@router.post("/exams/attempts/{attempt_id}/answers")
async def submit_answer(attempt_id: int, payload: ExamAnswerSubmit, db: DbSession, user: CurrentUser):
    return await service.submit_answer(db, attempt_id, user["id"], payload.questionId, payload.answer)


@router.post("/exams/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: int, db: DbSession, user: CurrentUser):
    return await service.submit_attempt(db, attempt_id, user["id"])


@router.get("/exams/attempts/{attempt_id}/results")
async def get_attempt_results(attempt_id: int, db: DbSession, user: CurrentUser):
    return await service.get_attempt_results(db, attempt_id, user["id"])
