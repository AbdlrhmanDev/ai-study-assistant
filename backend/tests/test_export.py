import csv
import io

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.flashcards.model import Flashcard
from app.modules.gamification.model import UserLevel, UserStreak
from app.modules.mastery.model import Concept, ConceptMastery
from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _make_topic(db_session: AsyncSession, user: User, title: str = "Cell Biology") -> Topic:
    topic = Topic(user_id=user.id, title=title, description="Test topic")
    db_session.add(topic)
    await db_session.flush()
    return topic


def _rows(csv_text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(csv_text)))


async def test_export_notes_returns_404_for_unowned_topic(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
) -> None:
    topic = await _make_topic(db_session, other_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/notes/export")

    assert response.status_code == 404


async def test_export_notes_csv_contains_all_notes(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
) -> None:
    topic = await _make_topic(db_session, test_user)
    db_session.add_all(
        [
            Note(topic_id=topic.id, title="Mitochondria", content="The powerhouse of the cell."),
            Note(topic_id=topic.id, title="Nucleus", content="Contains the genetic material."),
        ]
    )
    await db_session.flush()

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/notes/export?format=csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    assert ".csv" in response.headers["content-disposition"]
    rows = _rows(response.text)
    assert rows[0] == ["title", "content", "created_at", "updated_at"]
    assert len(rows) == 3  # header + 2 notes
    titles = {row[0] for row in rows[1:]}
    assert titles == {"Mitochondria", "Nucleus"}


async def test_export_notes_markdown_includes_topic_and_note_titles(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
) -> None:
    topic = await _make_topic(db_session, test_user, title="Photosynthesis")
    db_session.add(Note(topic_id=topic.id, title="Light Reactions", content="Happens in the thylakoid."))
    await db_session.flush()

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/notes/export?format=md")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert "# Photosynthesis" in response.text
    assert "## Light Reactions" in response.text
    assert "Happens in the thylakoid." in response.text


async def test_export_flashcards_returns_404_for_unowned_topic(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
) -> None:
    topic = await _make_topic(db_session, other_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards/export")

    assert response.status_code == 404


async def test_export_flashcards_csv_contains_all_cards(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
) -> None:
    topic = await _make_topic(db_session, test_user)
    db_session.add_all(
        [
            Flashcard(topic_id=topic.id, question="What is DNA?", answer="A nucleic acid.", origin="manual"),
            Flashcard(
                topic_id=topic.id,
                question="What is RNA?",
                answer="A nucleic acid.",
                origin="ai",
                status="archived",
            ),
        ]
    )
    await db_session.flush()

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards/export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    rows = _rows(response.text)
    assert rows[0][0] == "question"
    # Both active and archived cards are included in the export.
    assert len(rows) == 3


async def test_export_progress_report_pdf_with_no_data_does_not_crash(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/reports/progress")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


async def test_export_progress_report_csv_includes_seeded_data(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
) -> None:
    topic = await _make_topic(db_session, test_user, title="Organic Chemistry")
    db_session.add(UserLevel(user_id=test_user.id, topic_id=topic.id, total_xp=150))
    db_session.add(
        UserStreak(user_id=test_user.id, current_streak=3, longest_streak=5, last_active_date=None)
    )
    concept = Concept(topic_id=topic.id, name="Alkenes")
    db_session.add(concept)
    await db_session.flush()
    db_session.add(
        ConceptMastery(user_id=test_user.id, concept_id=concept.id, mastery_score=0.75, confidence_score=0.5)
    )
    await db_session.flush()

    response = await authed_client.get("/api/v1/reports/progress?format=csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    body = response.text
    assert "Organic Chemistry" in body
    assert "150" in body
    assert "Alkenes" in body
    assert "75%" in body
