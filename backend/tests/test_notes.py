from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User, title: str = "Topic") -> Topic:
    topic = Topic(user_id=user.id, title=title, description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def _create_note(db_session: AsyncSession, topic: Topic, title: str = "Note", content: str = "Content") -> Note:
    note = Note(topic_id=topic.id, title=title, content=content)
    db_session.add(note)
    await db_session.flush()
    return note


async def test_create_note_returns_201(authed_client: AsyncClient, db_session: AsyncSession, test_user: User):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/notes", json={"title": "New Note", "content": "Some content"}
    )

    assert response.status_code == 201
    body = response.json()["note"]
    assert body["title"] == "New Note"
    assert body["topic_id"] == topic.id


async def test_create_note_rejects_empty_content(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/notes", json={"title": "T", "content": ""})

    assert response.status_code == 422


async def test_create_note_in_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/notes", json={"title": "T", "content": "C"}
    )

    assert response.status_code == 404


async def test_list_notes_returns_notes_for_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    await _create_note(db_session, topic, "First")
    await _create_note(db_session, topic, "Second")

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/notes")

    assert response.status_code == 200
    titles = {note["title"] for note in response.json()["notes"]}
    assert titles == {"First", "Second"}


async def test_get_note_returns_owned_note(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    note = await _create_note(db_session, topic)

    response = await authed_client.get(f"/api/v1/notes/{note.id}")

    assert response.status_code == 200
    assert response.json()["note"]["id"] == note.id


async def test_get_note_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)
    note = await _create_note(db_session, topic)

    response = await authed_client.get(f"/api/v1/notes/{note.id}")

    assert response.status_code == 404


async def test_update_note_changes_content(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    note = await _create_note(db_session, topic)

    response = await authed_client.patch(f"/api/v1/notes/{note.id}", json={"content": "Updated content"})

    assert response.status_code == 200
    assert response.json()["note"]["content"] == "Updated content"


async def test_update_note_rejects_empty_payload(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    note = await _create_note(db_session, topic)

    response = await authed_client.patch(f"/api/v1/notes/{note.id}", json={})

    assert response.status_code == 422


async def test_move_note_to_owned_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    source = await _create_topic(db_session, test_user, "Source")
    target = await _create_topic(db_session, test_user, "Target")
    note = await _create_note(db_session, source)

    response = await authed_client.patch(f"/api/v1/notes/{note.id}/move", json={"targetTopicId": target.id})

    assert response.status_code == 200
    assert response.json()["note"]["topic_id"] == target.id


async def test_move_note_to_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    source = await _create_topic(db_session, test_user, "Source")
    someone_elses = await _create_topic(db_session, other_user, "Not Yours")
    note = await _create_note(db_session, source)

    response = await authed_client.patch(
        f"/api/v1/notes/{note.id}/move", json={"targetTopicId": someone_elses.id}
    )

    assert response.status_code == 404


async def test_delete_note_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    note = await _create_note(db_session, topic)

    delete_response = await authed_client.delete(f"/api/v1/notes/{note.id}")
    assert delete_response.status_code == 204

    get_response = await authed_client.get(f"/api/v1/notes/{note.id}")
    assert get_response.status_code == 404


async def test_paginated_notes_returns_pagination_meta(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    for index in range(3):
        await _create_note(db_session, topic, f"Note {index}")

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/notes/paginated?page=1&limit=2")

    assert response.status_code == 200
    body = response.json()
    assert len(body["notes"]) == 2
    assert body["pagination"]["total"] == 3


async def test_search_notes_filters_by_term(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    await _create_note(db_session, topic, "Photosynthesis basics", "Plants convert light to energy")
    await _create_note(db_session, topic, "Cell division", "Mitosis and meiosis")

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/notes/search?search=Photosynthesis")

    assert response.status_code == 200
    titles = [note["title"] for note in response.json()["notes"]]
    assert titles == ["Photosynthesis basics"]
