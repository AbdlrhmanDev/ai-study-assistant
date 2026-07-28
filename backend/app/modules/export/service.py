import csv
import io
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..flashcards import repository as flashcards_repository
from ..gamification import repository as gamification_repository
from ..mastery import repository as mastery_repository
from ..notes import repository as notes_repository
from ..study_history import repository as study_history_repository
from ..topics import repository as topics_repository
from ..topics import service as topics_service
from .rendering import render_progress_pdf

ExportFile = tuple[bytes, str, str]  # (content, media_type, filename)


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "export"


def _csv_bytes(header: list[str], rows: list[list[object]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


async def export_notes(db: AsyncSession, topic_id: int, user_id: int, format: str) -> ExportFile:
    topic = await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    notes = await notes_repository.list_by_topic(db, topic_id, user_id)
    slug = _slugify(topic.title)

    if format == "md":
        lines = [f"# {topic.title}", ""]
        for note in notes:
            lines.append(f"## {note.title}")
            lines.append("")
            lines.append(note.content)
            lines.append("")
        content = "\n".join(lines).encode("utf-8")
        return content, "text/markdown", f"{slug}-notes.md"

    content = _csv_bytes(
        ["title", "content", "created_at", "updated_at"],
        [
            [note.title, note.content, note.created_at.isoformat(), note.updated_at.isoformat()]
            for note in notes
        ],
    )
    return content, "text/csv", f"{slug}-notes.csv"


async def export_flashcards(db: AsyncSession, topic_id: int, user_id: int, format: str) -> ExportFile:
    topic = await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    rows = await flashcards_repository.list_by_topic(db, topic_id, status=None)
    slug = _slugify(topic.title)

    content = _csv_bytes(
        [
            "question", "answer", "explanation", "concept", "status", "origin",
            "due_at", "last_reviewed_at", "last_rating", "source",
        ],
        [
            [
                card.question,
                card.answer,
                card.explanation or "",
                card.concept or "",
                card.status,
                card.origin,
                card.due_at.isoformat(),
                card.last_reviewed_at.isoformat() if card.last_reviewed_at else "",
                card.last_rating or "",
                source_title or "",
            ]
            for card, _source_type, source_title in rows
        ],
    )
    return content, "text/csv", f"{slug}-flashcards.csv"


@dataclass
class ProgressReportData:
    generated_at: datetime
    total_activities: int
    activities_this_week: int
    ai_interactions: int
    topics_studied: int
    current_streak: int
    longest_streak: int
    topic_xp: list[tuple[str, int]]
    flashcard_reviews_total: int
    flashcard_retention_rate: float | None
    mastery: list[tuple[str, float]]


async def _build_progress_report(db: AsyncSession, user_id: int) -> ProgressReportData:
    stats = await study_history_repository.get_stats(db, user_id)
    streak = await gamification_repository.get_or_create_streak(db, user_id)
    levels = await gamification_repository.list_levels_for_user(db, user_id)
    topics = await topics_repository.list_by_user(db, user_id)
    topic_titles = {topic.id: topic.title for topic in topics}
    total_reviews, remembered_reviews = await flashcards_repository.retention_for_user(db, user_id)
    mastery_rows = await mastery_repository.list_mastery_for_user(db, user_id)

    return ProgressReportData(
        generated_at=datetime.now(timezone.utc),
        total_activities=stats["total_activities"],
        activities_this_week=stats["activities_this_week"],
        ai_interactions=stats["ai_interactions"],
        topics_studied=stats["topics_studied"],
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        topic_xp=[
            (topic_titles.get(level.topic_id, f"Topic #{level.topic_id}"), level.total_xp)
            for level in levels
        ],
        flashcard_reviews_total=total_reviews,
        flashcard_retention_rate=(remembered_reviews / total_reviews) if total_reviews else None,
        mastery=[(concept.name, mastery.mastery_score) for mastery, concept in mastery_rows],
    )


def _progress_csv(report: ProgressReportData) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Study progress report generated", report.generated_at.isoformat()])
    writer.writerow([])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total study activities", report.total_activities])
    writer.writerow(["Activities this week", report.activities_this_week])
    writer.writerow(["AI tutor interactions", report.ai_interactions])
    writer.writerow(["Topics studied", report.topics_studied])
    writer.writerow(["Current streak (days)", report.current_streak])
    writer.writerow(["Longest streak (days)", report.longest_streak])
    writer.writerow(["Flashcard reviews completed", report.flashcard_reviews_total])
    writer.writerow(
        [
            "Flashcard retention rate",
            f"{report.flashcard_retention_rate:.0%}"
            if report.flashcard_retention_rate is not None
            else "n/a",
        ]
    )
    writer.writerow([])
    writer.writerow(["Topic", "XP"])
    for title, xp in report.topic_xp:
        writer.writerow([title, xp])
    writer.writerow([])
    writer.writerow(["Concept", "Mastery score"])
    for name, score in report.mastery:
        writer.writerow([name, f"{score:.0%}"])
    return buffer.getvalue().encode("utf-8")


async def export_progress_report(db: AsyncSession, user_id: int, format: str) -> ExportFile:
    report = await _build_progress_report(db, user_id)
    if format == "csv":
        return _progress_csv(report), "text/csv", "progress-report.csv"
    return render_progress_pdf(report), "application/pdf", "progress-report.pdf"
