"""Phase 3 feature tests: exam draft/preview/editing, item-level analytics,
retention gating, workspace export/import, plan tiers, and artifact caching.

These mirror the project's savepoint-rollback test harness (see conftest.py)
and are currently written/verified statically -- the Docker-backed test
database is unreachable in this environment, so they are not executed here.
"""

import json

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

MOCK_QUIZ_RESPONSE = json.dumps([
    {
        "type": "multiple_choice", "concept": "Photosynthesis", "prompt": "What pigment absorbs light?",
        "choices": ["Chlorophyll", "Melanin", "Keratin", "Collagen"], "correctIndex": 0,
        "explanation": "Chlorophyll absorbs light for photosynthesis.", "sourceIndex": 1, "difficulty": 0.3,
    },
])

MOCK_EXAM_RESPONSE = json.dumps([
    {
        "type": "multiple_choice", "bloomsLevel": "remember", "concept": "Photosynthesis",
        "prompt": "What pigment absorbs light?", "choices": ["Chlorophyll", "Melanin", "Keratin", "Collagen"],
        "correctIndex": 0, "explanation": "Chlorophyll absorbs light.", "sourceIndex": 1,
    },
    {
        "type": "essay", "bloomsLevel": "analyze", "concept": "Photosynthesis",
        "prompt": "Explain the role of chlorophyll in photosynthesis.",
        "rubric": [
            {"criterion": "Mentions light absorption", "maxPoints": 3, "description": "Explains chlorophyll absorbs light"},
            {"criterion": "Mentions energy conversion", "maxPoints": 2, "description": "Explains conversion to chemical energy"},
        ],
        "explanation": "Chlorophyll absorbs light and converts it to chemical energy.", "sourceIndex": 1,
    },
])


@pytest.fixture
def counting_ai_generate(monkeypatch: pytest.MonkeyPatch):
    """Stubs `ai.provider.generate` and counts invocations so caching tests
    can assert the AI provider only ran the expected number of times."""
    import app.modules.ai.provider as provider

    calls = {"count": 0}

    async def _fake_generate(prompt: str, instructions: str = "") -> tuple[str, str, str]:
        calls["count"] += 1
        return MOCK_EXAM_RESPONSE, "mock", "mock-model"

    monkeypatch.setattr(provider, "generate", _fake_generate)
    return calls


async def _create_topic_with_note(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Photosynthesis", content="Plants convert light into energy using chlorophyll.")
    db_session.add(note)
    await db_session.flush()
    return topic


async def _generate_quiz(authed_client: AsyncClient, topic_id: int) -> dict:
    response = await authed_client.post(
        f"/api/v1/topics/{topic_id}/quizzes/generate", json={"source": "topic", "count": 1}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _generate_exam(authed_client: AsyncClient, topic_id: int, preview: bool = False) -> dict:
    response = await authed_client.post(
        f"/api/v1/topics/{topic_id}/exams/generate",
        json={"count": 4, "timeLimitMinutes": 30, "preview": preview},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_exam_preview_stays_draft_until_published(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)

    draft = await _generate_exam(authed_client, topic.id, preview=True)
    exam_id = draft["exam"]["id"]
    assert draft["exam"]["status"] == "draft"

    # A draft cannot be started as if it were final.
    taken = await authed_client.get(f"/api/v1/exams/{exam_id}")
    assert taken.status_code == 409

    # Review exposes the answer key/rubric that taking hides.
    review = await authed_client.get(f"/api/v1/exams/{exam_id}/review")
    assert review.status_code == 200
    review_body = review.json()
    assert review_body["exam"]["status"] == "draft"
    assert all("correctAnswer" in q or "rubric" in q for q in review_body["questions"])

    # Publishing flips it to takeable.
    published = await authed_client.post(f"/api/v1/exams/{exam_id}/publish")
    assert published.status_code == 200
    assert published.json()["exam"]["status"] == "published"

    taken = await authed_client.get(f"/api/v1/exams/{exam_id}")
    assert taken.status_code == 200
    assert "correctAnswer" not in taken.json()["questions"][0]


async def test_exam_draft_questions_can_be_edited_deleted_regenerated(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    draft = await _generate_exam(authed_client, topic.id, preview=True)
    exam_id = draft["exam"]["id"]
    question_id = draft["questions"][0]["id"]

    edited = await authed_client.patch(
        f"/api/v1/exams/{exam_id}/questions/{question_id}",
        json={"prompt": "Which pigment absorbs red light?"},
    )
    assert edited.status_code == 200
    assert edited.json()["prompt"] == "Which pigment absorbs red light?"

    regenerated = await authed_client.post(
        f"/api/v1/exams/{exam_id}/questions/{question_id}/regenerate"
    )
    assert regenerated.status_code == 200
    assert regenerated.json()["id"] == question_id

    deleted = await authed_client.delete(f"/api/v1/exams/{exam_id}/questions/{question_id}")
    assert deleted.status_code == 204

    gone = await authed_client.get(f"/api/v1/exams/{exam_id}/review")
    assert all(q["id"] != question_id for q in gone.json()["questions"])


async def test_exam_edit_rejected_after_publish(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    draft = await _generate_exam(authed_client, topic.id, preview=True)
    exam_id = draft["exam"]["id"]
    question_id = draft["questions"][0]["id"]
    await authed_client.post(f"/api/v1/exams/{exam_id}/publish")

    edited = await authed_client.patch(
        f"/api/v1/exams/{exam_id}/questions/{question_id}", json={"prompt": "Changed after publish?"}
    )
    assert edited.status_code == 409


async def test_quiz_calibration_endpoint_returns_shape(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await _generate_quiz(authed_client, topic.id)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/quiz-analytics")
    assert response.status_code == 200
    body = response.json()
    assert body["topicId"] == topic.id
    assert set(body) == {"topicId", "averages", "questions", "concepts", "mostMissedConcepts", "misCalibratedQuestions"}
    assert "recommendedDifficulty" in body["averages"]


async def test_exam_analytics_endpoint_returns_shape(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await _generate_exam(authed_client, topic.id)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/exam-analytics")
    assert response.status_code == 200
    body = response.json()
    assert "mostMissedConcepts" in body and "averages" in body


async def test_retention_endpoint_hidden_from_non_admin(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User,
):
    response = await authed_client.get("/api/v1/analytics/retention")
    assert response.status_code == 404


async def test_workspace_export_import_roundtrip(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User,
):
    created = await authed_client.post(
        "/api/v1/workspace-pages", json={"title": "Study Notes"}
    )
    assert created.status_code == 201
    page_id = created.json()["page"]["id"]

    saved = await authed_client.patch(
        f"/api/v1/workspace-pages/{page_id}",
        json={"blocks": [{"id": "b1", "type": "text", "content": "Hello", "children": []}]},
    )
    assert saved.status_code == 200

    exported = await authed_client.get("/api/v1/workspace-pages/export")
    assert exported.status_code == 200
    payload = exported.json()

    imported = await authed_client.post("/api/v1/workspace-pages/import", json=payload)
    assert imported.status_code == 201
    imported_pages = imported.json()["pages"]
    assert isinstance(imported_pages, list) and len(imported_pages) >= 1
    assert imported_pages[0]["title"] == "Study Notes"


async def test_plans_me_returns_resolved_limits(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User,
):
    response = await authed_client.get("/api/v1/plans/me")
    assert response.status_code == 200
    body = response.json()
    assert body["plan"] in {"beta", "pro"}
    assert body["storageBytes"] > 0
    assert body["monthlyRequestLimit"] > 0


async def test_artifact_cache_serves_identical_generation_and_invalidates_on_material_change(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, counting_ai_generate: dict,
):
    topic = await _create_topic_with_note(db_session, test_user)

    first = await authed_client.post(
        f"/api/v1/topics/{topic.id}/exams/generate", json={"count": 4}
    )
    second = await authed_client.post(
        f"/api/v1/topics/{topic.id}/exams/generate", json={"count": 4}
    )
    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["exam"]["id"] == second.json()["exam"]["id"]
    assert counting_ai_generate["count"] == 1

    # A new note changes the material fingerprint, so the cache no longer hits.
    db_session.add(Note(topic_id=topic.id, title="Respiration", content="Cells release energy from glucose."))
    await db_session.flush()

    third = await authed_client.post(
        f"/api/v1/topics/{topic.id}/exams/generate", json={"count": 4}
    )
    assert third.status_code == 201
    assert third.json()["exam"]["id"] != first.json()["exam"]["id"]
    assert counting_ai_generate["count"] == 2
