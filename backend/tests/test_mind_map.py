import json
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

MOCK_MIND_MAP_RESPONSE = json.dumps({
    "title": "Photosynthesis",
    "children": [
        {"title": "Light Reactions", "children": [{"title": "Chlorophyll", "children": []}]},
        {"title": "Calvin Cycle", "children": []},
    ],
})


async def _create_topic_with_note(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Photosynthesis", content="Plants convert light into energy using chlorophyll.")
    db_session.add(note)
    await db_session.flush()
    return topic


async def test_get_mind_map_before_generation_returns_empty(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic_with_note(db_session, test_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/mind-map")

    assert response.status_code == 200
    body = response.json()
    assert body["structure"] is None and body["nodeCount"] == 0 and body["updatedAt"] is None
    assert body["buildStatus"] == {"status": "completed", "errorMessage": None}


async def test_rebuild_mind_map_creates_structure(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_MIND_MAP_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)

    rebuild = await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")
    assert rebuild.status_code == 202, rebuild.text
    assert rebuild.json()["status"] == "completed"

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/mind-map")
    assert response.status_code == 200
    body = response.json()
    assert body["structure"]["title"] == "Photosynthesis"
    assert body["nodeCount"] == 4  # root + 2 branches + 1 sub-branch
    assert body["buildStatus"] == {"status": "completed", "errorMessage": None}


async def test_rebuild_mind_map_without_content_returns_422_and_records_failed_status(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = Topic(user_id=test_user.id, title="Empty Topic", description=None)
    db_session.add(topic)
    await db_session.flush()

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")

    assert response.status_code == 422
    mind_map = await authed_client.get(f"/api/v1/topics/{topic.id}/mind-map")
    assert mind_map.json()["buildStatus"]["status"] == "failed"


async def test_rebuild_mind_map_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User, mock_ai_generate
):
    topic = await _create_topic_with_note(db_session, other_user)

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")

    assert response.status_code == 404


async def test_get_mind_map_after_rebuild_returns_saved_structure(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_MIND_MAP_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/mind-map")

    assert response.status_code == 200
    assert response.json()["nodeCount"] == 4


async def test_rebuild_mind_map_immediately_after_completion_is_cooldown_gated(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_MIND_MAP_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")

    second = await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")

    assert second.status_code == 429
    assert second.json()["details"]["retryAfterSeconds"] > 0


async def test_rebuild_mind_map_after_cooldown_elapses_succeeds(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_MIND_MAP_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")
    await db_session.execute(
        text(
            "UPDATE topic_build_status SET updated_at = :stale "
            "WHERE topic_id = :topic_id AND build_type = 'mind_map'"
        ),
        {"stale": datetime.now(timezone.utc) - timedelta(minutes=5), "topic_id": topic.id},
    )
    await db_session.commit()

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/mind-map/rebuild")

    assert response.status_code == 202
    assert response.json()["status"] == "completed"
