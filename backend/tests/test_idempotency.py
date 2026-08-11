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


async def _create_topic_with_note(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Photosynthesis", content="Plants convert light into energy using chlorophyll.")
    db_session.add(note)
    await db_session.flush()
    return topic


@pytest.fixture
def counting_ai_generate(monkeypatch: pytest.MonkeyPatch):
    """Like `mock_ai_generate`, but counts real invocations so a test can
    assert a duplicate submission never called the AI provider twice."""
    import app.modules.ai.provider as provider

    calls = {"count": 0}

    async def _fake_generate(prompt: str, instructions: str = "") -> tuple[str, str, str]:
        calls["count"] += 1
        return MOCK_QUIZ_RESPONSE, "mock", "mock-model"

    monkeypatch.setattr(provider, "generate", _fake_generate)
    return calls


async def test_duplicate_quiz_generate_with_same_idempotency_key_reuses_result(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, counting_ai_generate: dict,
) -> None:
    topic = await _create_topic_with_note(db_session, test_user)
    headers = {"Idempotency-Key": "click-1"}

    first = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 1}, headers=headers,
    )
    second = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 1}, headers=headers,
    )

    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["quiz"]["id"] == second.json()["quiz"]["id"]
    assert counting_ai_generate["count"] == 1


async def test_quiz_generate_without_idempotency_key_always_generates_fresh(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, counting_ai_generate: dict,
) -> None:
    topic = await _create_topic_with_note(db_session, test_user)

    first = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 1}
    )
    second = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 1}
    )

    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["quiz"]["id"] != second.json()["quiz"]["id"]
    assert counting_ai_generate["count"] == 2


async def test_different_idempotency_keys_both_generate(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, counting_ai_generate: dict,
) -> None:
    topic = await _create_topic_with_note(db_session, test_user)

    first = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 1},
        headers={"Idempotency-Key": "click-1"},
    )
    second = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 1},
        headers={"Idempotency-Key": "click-2"},
    )

    assert first.json()["quiz"]["id"] != second.json()["quiz"]["id"]
    assert counting_ai_generate["count"] == 2
