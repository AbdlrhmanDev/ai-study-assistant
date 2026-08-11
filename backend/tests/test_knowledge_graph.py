import json

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

MOCK_GRAPH_RESPONSE = json.dumps({
    "concepts": [
        {"name": "Chlorophyll", "description": "Pigment that absorbs light."},
        {"name": "Photosynthesis", "description": "Process converting light to energy."},
        {"name": "Chloroplast", "description": "Organelle where photosynthesis occurs."},
    ],
    "relations": [
        {"from": "Chlorophyll", "to": "Photosynthesis", "type": "part_of", "confidence": 0.9},
        {"from": "Chloroplast", "to": "Photosynthesis", "type": "related", "confidence": 0.8},
    ],
})


async def _create_topic_with_note(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Photosynthesis", content="Plants convert light into energy using chlorophyll in chloroplasts.")
    db_session.add(note)
    await db_session.flush()
    return topic


async def test_get_graph_below_minimum_concepts_returns_empty(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic_with_note(db_session, test_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/knowledge-graph")

    assert response.status_code == 200
    body = response.json()
    assert body["nodes"] == [] and body["edges"] == [] and body["belowMinimum"] is True
    assert body["buildStatus"] == {"status": "completed", "errorMessage": None}


async def test_rebuild_graph_creates_nodes_and_edges(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_GRAPH_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)

    rebuild = await authed_client.post(f"/api/v1/topics/{topic.id}/knowledge-graph/rebuild")
    assert rebuild.status_code == 202, rebuild.text
    # No REDIS_URL in tests -> the rebuild runs inline before the response
    # returns, so the status is already terminal.
    assert rebuild.json()["status"] == "completed"

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/knowledge-graph")
    assert response.status_code == 200
    body = response.json()
    assert body["belowMinimum"] is False
    assert len(body["nodes"]) == 3
    assert len(body["edges"]) == 2
    assert body["buildStatus"] == {"status": "completed", "errorMessage": None}
    names = {node["name"] for node in body["nodes"]}
    assert names == {"Chlorophyll", "Photosynthesis", "Chloroplast"}


async def test_rebuild_graph_without_content_returns_422_and_records_failed_status(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = Topic(user_id=test_user.id, title="Empty Topic", description=None)
    db_session.add(topic)
    await db_session.flush()

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/knowledge-graph/rebuild")

    assert response.status_code == 422
    graph = await authed_client.get(f"/api/v1/topics/{topic.id}/knowledge-graph")
    assert graph.json()["buildStatus"]["status"] == "failed"


async def test_rebuild_graph_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User, mock_ai_generate
):
    topic = await _create_topic_with_note(db_session, other_user)

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/knowledge-graph/rebuild")

    assert response.status_code == 404


async def test_get_concept_returns_detail(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_GRAPH_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await authed_client.post(f"/api/v1/topics/{topic.id}/knowledge-graph/rebuild")
    graph = await authed_client.get(f"/api/v1/topics/{topic.id}/knowledge-graph")
    concept_id = graph.json()["nodes"][0]["id"]

    response = await authed_client.get(f"/api/v1/concepts/{concept_id}")

    assert response.status_code == 200
    assert response.json()["id"] == concept_id


async def test_get_concept_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_GRAPH_RESPONSE)
    topic = await _create_topic_with_note(db_session, other_user)
    from app.modules.knowledge_graph import service as kg_service

    rebuilt = await kg_service.rebuild_graph(db_session, topic.id, other_user.id)
    concept_id = rebuilt["nodes"][0]["id"]

    response = await authed_client.get(f"/api/v1/concepts/{concept_id}")

    assert response.status_code == 404
