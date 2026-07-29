import json

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

MOCK_FLASHCARD_RESPONSE = json.dumps([
    {"question": "What absorbs light in plants?", "answer": "Chlorophyll", "explanation": "It's the main pigment.", "concept": "Photosynthesis"},
    {"question": "Where does photosynthesis occur?", "answer": "Chloroplasts", "explanation": "", "concept": "Photosynthesis"},
])


async def _create_topic_with_note(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Photosynthesis", content="Plants convert light into energy using chlorophyll.")
    db_session.add(note)
    await db_session.flush()
    return topic


async def test_generate_flashcards_creates_cards(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_FLASHCARD_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards/generate", json={"source": "topic", "count": 2}
    )

    assert response.status_code == 201
    cards = response.json()["flashcards"]
    assert len(cards) == 2
    assert cards[0]["origin"] == "ai"
    assert cards[0]["question"] == "What absorbs light in plants?"


async def test_generate_flashcards_without_content_returns_422(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = Topic(user_id=test_user.id, title="Empty Topic", description=None)
    db_session.add(topic)
    await db_session.flush()

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards/generate", json={"source": "topic", "count": 2}
    )

    assert response.status_code == 422


async def test_create_manual_flashcard(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Manual Topic", description=None)
    db_session.add(topic)
    await db_session.flush()

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards",
        json={"question": "2+2?", "answer": "4"},
    )

    assert response.status_code == 201
    assert response.json()["flashcard"]["origin"] == "manual"


async def test_list_flashcards_defaults_to_active_status(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    create_response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards", json={"question": "Q", "answer": "A"}
    )
    flashcard_id = create_response.json()["flashcard"]["id"]
    await authed_client.patch(f"/api/v1/flashcards/{flashcard_id}/archive", json={"archived": True})

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards")

    assert response.status_code == 200
    assert response.json()["flashcards"] == []


async def test_review_flashcard_updates_schedule_and_awards_xp(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    create_response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards", json={"question": "Q", "answer": "A"}
    )
    flashcard_id = create_response.json()["flashcard"]["id"]

    response = await authed_client.post(f"/api/v1/flashcards/{flashcard_id}/review", json={"rating": "easy"})

    assert response.status_code == 200
    body = response.json()
    assert body["flashcard"]["repetitions"] == 1
    assert body["flashcard"]["last_rating"] == "easy"


async def test_update_flashcard_rejects_empty_payload(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    create_response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards", json={"question": "Q", "answer": "A"}
    )
    flashcard_id = create_response.json()["flashcard"]["id"]

    response = await authed_client.patch(f"/api/v1/flashcards/{flashcard_id}", json={})

    assert response.status_code == 422


async def test_delete_flashcard_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    create_response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards", json={"question": "Q", "answer": "A"}
    )
    flashcard_id = create_response.json()["flashcard"]["id"]

    delete_response = await authed_client.delete(f"/api/v1/flashcards/{flashcard_id}")
    assert delete_response.status_code == 204

    list_response = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards")
    assert list_response.json()["flashcards"] == []


async def test_deck_stats_returns_totals(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    await authed_client.post(f"/api/v1/topics/{topic.id}/flashcards", json={"question": "Q", "answer": "A"})

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards/stats")

    assert response.status_code == 200
    assert response.json()["total"] == 1
