from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai.model import Document
from app.modules.exams.model import Exam
from app.modules.flashcards.model import Flashcard
from app.modules.notes.model import Note
from app.modules.quizzes.model import Quiz
from app.modules.topics.model import Topic
from app.modules.users.model import User
from app.modules.workspace.model import WorkspacePage


async def test_study_search_covers_every_content_type(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User,
) -> None:
    topic = Topic(user_id=test_user.id, title="Photosynthesis Basics", description=None)
    db_session.add(topic)
    await db_session.flush()

    db_session.add_all([
        Note(topic_id=topic.id, title="Photosynthesis notes", content="chlorophyll"),
        Document(
            topic_id=topic.id, title="Photosynthesis diagram", original_filename="photosynthesis.pdf",
            content_type="application/pdf", status="completed",
        ),
        Quiz(topic_id=topic.id, title="Photosynthesis quiz", source_type="topic"),
        Exam(topic_id=topic.id, title="Photosynthesis exam", time_limit_seconds=1800),
        Flashcard(
            topic_id=topic.id, question="What is photosynthesis?", answer="Converting light to energy",
            status="active",
        ),
        WorkspacePage(user_id=test_user.id, topic_id=topic.id, title="Photosynthesis workspace page", blocks=[]),
    ])
    await db_session.flush()

    response = await authed_client.get("/api/v1/study-search", params={"q": "Photosynthesis"})

    assert response.status_code == 200
    body = response.json()
    assert body["topics"] and body["topics"][0]["title"] == "Photosynthesis Basics"
    assert body["notes"] and "Photosynthesis" in body["notes"][0]["title"]
    assert body["documents"] and "Photosynthesis" in body["documents"][0]["title"]
    assert body["quizzes"] and "Photosynthesis" in body["quizzes"][0]["title"]
    assert body["exams"] and "Photosynthesis" in body["exams"][0]["title"]
    assert body["flashcards"] and "photosynthesis" in body["flashcards"][0]["snippet"].lower()
    assert body["workspacePages"] and "Photosynthesis" in body["workspacePages"][0]["title"]


async def test_study_search_scoped_to_owner(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User,
) -> None:
    topic = Topic(user_id=other_user.id, title="Someone else's unique topic name", description=None)
    db_session.add(topic)
    await db_session.flush()

    response = await authed_client.get("/api/v1/study-search", params={"q": "unique topic"})

    assert response.status_code == 200
    assert response.json()["topics"] == []


async def test_study_search_empty_query_returns_empty_shape(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/study-search", params={"q": ""})

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"topics", "notes", "documents", "workspacePages", "quizzes", "exams", "flashcards"}
    assert all(value == [] for value in body.values())
