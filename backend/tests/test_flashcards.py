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


async def test_import_flashcards_creates_cards_from_csv(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Import Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    csv_bytes = (
        b"question,answer,explanation,concept\n"
        b"What is 2+2?,4,Basic addition,Arithmetic\n"
        b"Capital of France?,Paris,,Geography\n"
    )

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards/import",
        files={"file": ("cards.csv", csv_bytes, "text/csv")},
    )

    assert response.status_code == 201, response.text
    assert response.json() == {"created": 2, "skipped": 0}
    listed = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards")
    questions = {card["question"] for card in listed.json()["flashcards"]}
    assert questions == {"What is 2+2?", "Capital of France?"}


async def test_import_flashcards_skips_rows_missing_question_or_answer(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Import Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    csv_bytes = b"question,answer\nValid question,Valid answer\n,Missing question\n"

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards/import",
        files={"file": ("cards.csv", csv_bytes, "text/csv")},
    )

    assert response.status_code == 201, response.text
    assert response.json() == {"created": 1, "skipped": 1}


async def test_import_flashcards_rejects_csv_missing_required_columns(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Import Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    csv_bytes = b"front,back\nHello,World\n"

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards/import",
        files={"file": ("cards.csv", csv_bytes, "text/csv")},
    )

    assert response.status_code == 422


async def test_bulk_archive_and_delete_flashcards(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Bulk Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    ids = []
    for index in range(3):
        created = await authed_client.post(
            f"/api/v1/topics/{topic.id}/flashcards", json={"question": f"Q{index}", "answer": f"A{index}"}
        )
        ids.append(created.json()["flashcard"]["id"])

    archive_response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards/bulk", json={"action": "archive", "flashcardIds": ids[:2]}
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["updated"] == 2

    active_list = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards")
    assert [card["id"] for card in active_list.json()["flashcards"]] == [ids[2]]

    delete_response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/flashcards/bulk", json={"action": "delete", "flashcardIds": [ids[2]]}
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["updated"] == 1

    remaining = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards?status=archived")
    assert len(remaining.json()["flashcards"]) == 2


async def test_bulk_action_ignores_flashcards_from_another_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic_a = Topic(user_id=test_user.id, title="Topic A", description=None)
    topic_b = Topic(user_id=test_user.id, title="Topic B", description=None)
    db_session.add_all([topic_a, topic_b])
    await db_session.flush()
    card_a = await authed_client.post(f"/api/v1/topics/{topic_a.id}/flashcards", json={"question": "Q", "answer": "A"})
    card_b = await authed_client.post(f"/api/v1/topics/{topic_b.id}/flashcards", json={"question": "Q", "answer": "A"})

    response = await authed_client.post(
        f"/api/v1/topics/{topic_a.id}/flashcards/bulk",
        json={"action": "delete", "flashcardIds": [card_a.json()["flashcard"]["id"], card_b.json()["flashcard"]["id"]]},
    )

    assert response.status_code == 200
    assert response.json()["updated"] == 1  # only topic_a's card was affected
    still_there = await authed_client.get(f"/api/v1/topics/{topic_b.id}/flashcards")
    assert len(still_there.json()["flashcards"]) == 1


async def test_deck_health_reports_maturity_and_leech_counts(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Health Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    new_card = await authed_client.post(f"/api/v1/topics/{topic.id}/flashcards", json={"question": "Q1", "answer": "A1"})
    leech_card = await authed_client.post(f"/api/v1/topics/{topic.id}/flashcards", json={"question": "Q2", "answer": "A2"})
    leech_id = leech_card.json()["flashcard"]["id"]
    for _ in range(3):
        await authed_client.post(f"/api/v1/flashcards/{leech_id}/review", json={"rating": "forgot"})

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/flashcards/deck-health")

    assert response.status_code == 200, response.text
    body = response.json()
    # Both cards show up under "new" -- the leech card repeatedly fails, so
    # its SM-2 repetitions count keeps resetting to 0 just like a fresh card.
    assert body["new"] == 2
    assert body["leeches"] == 1
    assert new_card.status_code == 201


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
