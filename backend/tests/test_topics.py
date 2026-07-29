import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User, title: str = "Machine Learning") -> Topic:
    topic = Topic(user_id=user.id, title=title, description="A topic")
    db_session.add(topic)
    await db_session.flush()
    return topic


async def test_create_topic_returns_201(authed_client: AsyncClient):
    response = await authed_client.post("/api/v1/topics", json={"title": "New Topic", "description": "Desc"})
    assert response.status_code == 201
    body = response.json()["topic"]
    assert body["title"] == "New Topic"
    assert body["description"] == "Desc"


async def test_create_topic_rejects_empty_title(authed_client: AsyncClient):
    response = await authed_client.post("/api/v1/topics", json={"title": ""})
    assert response.status_code == 422


async def test_create_topic_requires_auth(client: AsyncClient):
    response = await client.post("/api/v1/topics", json={"title": "New Topic"})
    assert response.status_code == 401


async def test_list_topics_only_returns_own_topics(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    mine = await _create_topic(db_session, test_user, "Mine")
    await _create_topic(db_session, other_user, "Not Mine")

    response = await authed_client.get("/api/v1/topics")

    assert response.status_code == 200
    titles = [topic["title"] for topic in response.json()["topics"]]
    assert titles == ["Mine"]
    assert response.json()["topics"][0]["id"] == mine.id


async def test_get_topic_returns_owned_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}")

    assert response.status_code == 200
    assert response.json()["topic"]["id"] == topic.id


async def test_get_topic_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}")

    assert response.status_code == 404


async def test_get_missing_topic_returns_404(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/topics/999999999")
    assert response.status_code == 404


async def test_update_topic_changes_title(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.patch(f"/api/v1/topics/{topic.id}", json={"title": "Renamed"})

    assert response.status_code == 200
    assert response.json()["topic"]["title"] == "Renamed"


async def test_update_topic_rejects_empty_payload(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.patch(f"/api/v1/topics/{topic.id}", json={})

    assert response.status_code == 422


async def test_update_topic_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.patch(f"/api/v1/topics/{topic.id}", json={"title": "Hijacked"})

    assert response.status_code == 404


async def test_delete_topic_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    delete_response = await authed_client.delete(f"/api/v1/topics/{topic.id}")
    assert delete_response.status_code == 204

    get_response = await authed_client.get(f"/api/v1/topics/{topic.id}")
    assert get_response.status_code == 404


async def test_delete_topic_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.delete(f"/api/v1/topics/{topic.id}")

    assert response.status_code == 404
