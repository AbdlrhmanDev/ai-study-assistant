from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.model import Document
from ..exams.model import Exam, ExamAnswer, ExamAttempt, ExamQuestion
from ..flashcards import service as flashcards_service
from ..flashcards.model import Flashcard
from ..mastery import service as mastery_service
from ..notes.model import Note
from ..quizzes.model import Quiz, QuizAnswer, QuizAttempt, QuizQuestion
from ..study_history.model import StudyActivity
from ..topics.model import Topic
from ..workspace.model import WorkspacePage


def _answer_text(value: dict | None) -> str:
    if not value:
        return "No answer"
    for key in ("value", "text", "answer", "selected", "choice"):
        if key in value:
            return str(value[key])
    return ", ".join(str(item) for item in value.values())


async def list_mistakes(db: AsyncSession, user_id: int, limit: int = 50) -> list[dict]:
    quiz_stmt = (
        select(QuizAnswer, QuizQuestion, QuizAttempt, Quiz, Topic)
        .join(QuizAttempt, QuizAttempt.id == QuizAnswer.attempt_id)
        .join(QuizQuestion, QuizQuestion.id == QuizAnswer.question_id)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .join(Topic, Topic.id == Quiz.topic_id)
        .where(QuizAttempt.user_id == user_id, QuizAttempt.status == "completed", QuizAnswer.is_correct.is_(False))
        .order_by(QuizAnswer.answered_at.desc()).limit(limit)
    )
    exam_stmt = (
        select(ExamAnswer, ExamQuestion, ExamAttempt, Exam, Topic)
        .join(ExamAttempt, ExamAttempt.id == ExamAnswer.attempt_id)
        .join(ExamQuestion, ExamQuestion.id == ExamAnswer.question_id)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .join(Topic, Topic.id == Exam.topic_id)
        .where(ExamAttempt.user_id == user_id, ExamAttempt.status == "completed", ExamAnswer.is_correct.is_(False))
        .order_by(ExamAnswer.answered_at.desc()).limit(limit)
    )
    quiz_rows = (await db.execute(quiz_stmt)).all()
    exam_rows = (await db.execute(exam_stmt)).all()
    items = [
        {
            "id": f"quiz-{answer.id}", "sourceType": "quiz", "sourceId": quiz.id,
            "attemptId": attempt.id, "topicId": topic.id, "topicTitle": topic.title,
            "activityTitle": quiz.title, "concept": question.concept, "prompt": question.prompt,
            "studentAnswer": _answer_text(answer.student_answer),
            "correctAnswer": _answer_text(question.correct_answer), "explanation": question.explanation,
            "mistakeType": answer.mistake_type, "diagnosis": answer.diagnosis,
            "answeredAt": answer.answered_at.isoformat(),
        }
        for answer, question, attempt, quiz, topic in quiz_rows
    ]
    items.extend(
        {
            "id": f"exam-{answer.id}", "sourceType": "exam", "sourceId": exam.id,
            "attemptId": attempt.id, "topicId": topic.id, "topicTitle": topic.title,
            "activityTitle": exam.title, "concept": question.concept, "prompt": question.prompt,
            "studentAnswer": _answer_text(answer.student_answer),
            "correctAnswer": _answer_text(question.correct_answer), "explanation": question.explanation,
            "mistakeType": None, "diagnosis": None, "answeredAt": answer.answered_at.isoformat(),
        }
        for answer, question, attempt, exam, topic in exam_rows
    )
    items.sort(key=lambda item: item["answeredAt"], reverse=True)
    return items[:limit]


async def summary(db: AsyncSession, user_id: int) -> dict:
    flashcards = await flashcards_service.get_dashboard_stats(db, user_id)
    concepts = await mastery_service.list_all_concepts_for_planning(db, user_id)
    weak = sorted(concepts, key=lambda item: item.mastery_score)[:6]
    mistakes = await list_mistakes(db, user_id, 8)
    topics = (await db.execute(select(Topic.id, Topic.title).where(Topic.user_id == user_id))).all()
    topic_titles = {topic_id: title for topic_id, title in topics}
    return {
        "overdueFlashcards": flashcards["due_today"],
        "weakConcepts": [{"conceptId": item.concept_id, "conceptName": item.concept_name,
                          "topicId": item.topic_id, "topicTitle": topic_titles.get(item.topic_id, "Topic"),
                          "masteryScore": round(item.mastery_score * 100)} for item in weak],
        "recentMistakes": mistakes,
    }


async def weekly_report(db: AsyncSession, user_id: int) -> dict:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=6)
    activity_rows = (await db.execute(
        select(StudyActivity.activity_type, func.count(StudyActivity.id))
        .where(StudyActivity.user_id == user_id, StudyActivity.created_at >= start)
        .group_by(StudyActivity.activity_type)
    )).all()
    day_rows = (await db.execute(
        select(func.date(StudyActivity.created_at), func.count(StudyActivity.id))
        .where(StudyActivity.user_id == user_id, StudyActivity.created_at >= start)
        .group_by(func.date(StudyActivity.created_at))
    )).all()
    summary_data = await summary(db, user_id)
    by_type = dict(activity_rows)
    by_day = {str(day): count for day, count in day_rows}
    days = []
    for offset in range(7):
        current = (start + timedelta(days=offset)).date()
        days.append({"date": current.isoformat(), "activities": by_day.get(current.isoformat(), 0)})
    total = sum(by_type.values())
    return {
        "periodStart": start.date().isoformat(), "periodEnd": now.date().isoformat(),
        "totalActivities": total, "activeDays": sum(day["activities"] > 0 for day in days),
        "quizSessions": by_type.get("quiz_completed", 0),
        "flashcardReviews": by_type.get("flashcard_reviewed", 0),
        "aiQuestions": by_type.get("ai_chat", 0), "dailyActivity": days,
        "overdueFlashcards": summary_data["overdueFlashcards"],
        "weakConcepts": summary_data["weakConcepts"],
        "recentMistakes": summary_data["recentMistakes"],
        "recommendation": "Review overdue cards first, then practise your weakest concept."
            if summary_data["overdueFlashcards"] else "Practise your weakest concept, then check recent mistakes.",
    }


async def search(db: AsyncSession, user_id: int, query: str) -> dict:
    term = f"%{query.strip()}%"
    limit = 8

    topics = (await db.execute(
        select(Topic).where(Topic.user_id == user_id, or_(Topic.title.ilike(term), Topic.description.ilike(term))).limit(limit)
    )).scalars().all()
    notes = (await db.execute(
        select(Note, Topic.title).join(Topic, Topic.id == Note.topic_id)
        .where(Topic.user_id == user_id, or_(Note.title.ilike(term), Note.content.ilike(term))).limit(limit)
    )).all()
    documents = (await db.execute(
        select(Document, Topic.title).join(Topic, Topic.id == Document.topic_id)
        .where(Topic.user_id == user_id, or_(Document.title.ilike(term), Document.original_filename.ilike(term)))
        .limit(limit)
    )).all()
    workspace_pages = (await db.execute(
        select(WorkspacePage).where(WorkspacePage.user_id == user_id, WorkspacePage.title.ilike(term)).limit(limit)
    )).scalars().all()
    quizzes = (await db.execute(
        select(Quiz, Topic.title).join(Topic, Topic.id == Quiz.topic_id)
        .where(Topic.user_id == user_id, Quiz.title.ilike(term)).limit(limit)
    )).all()
    exams = (await db.execute(
        select(Exam, Topic.title).join(Topic, Topic.id == Exam.topic_id)
        .where(Topic.user_id == user_id, Exam.title.ilike(term)).limit(limit)
    )).all()
    flashcards = (await db.execute(
        select(Flashcard, Topic.title).join(Topic, Topic.id == Flashcard.topic_id)
        .where(Topic.user_id == user_id, Flashcard.status == "active", Flashcard.question.ilike(term))
        .limit(limit)
    )).all()

    return {
        "topics": [{"id": item.id, "title": item.title, "description": item.description} for item in topics],
        "notes": [{"id": note.id, "topicId": note.topic_id, "topicTitle": title,
                   "title": note.title, "snippet": note.content[:180]} for note, title in notes],
        "documents": [{"id": doc.id, "topicId": doc.topic_id, "topicTitle": title,
                       "title": doc.title, "status": doc.status} for doc, title in documents],
        "workspacePages": [{"id": page.id, "title": page.title} for page in workspace_pages],
        "quizzes": [{"id": quiz.id, "topicId": quiz.topic_id, "topicTitle": title, "title": quiz.title}
                    for quiz, title in quizzes],
        "exams": [{"id": exam.id, "topicId": exam.topic_id, "topicTitle": title, "title": exam.title}
                  for exam, title in exams],
        "flashcards": [{"id": card.id, "topicId": card.topic_id, "topicTitle": title, "snippet": card.question[:180]}
                       for card, title in flashcards],
    }
