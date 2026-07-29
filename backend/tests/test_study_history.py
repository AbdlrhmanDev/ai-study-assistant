from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.model import User


async def test_list_study_history_empty_for_new_user(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/study-history")

    assert response.status_code == 200
    body = response.json()
    assert body["activities"] == []
    assert body["pagination"]["total"] == 0


async def test_creating_a_topic_records_activity(authed_client: AsyncClient):
    await authed_client.post("/api/v1/topics", json={"title": "New Topic"})

    response = await authed_client.get("/api/v1/study-history")

    assert response.status_code == 200
    activity_types = [activity["activity_type"] for activity in response.json()["activities"]]
    assert "topic_created" in activity_types


async def test_list_study_history_filters_by_type(authed_client: AsyncClient):
    await authed_client.post("/api/v1/topics", json={"title": "New Topic"})

    response = await authed_client.get("/api/v1/study-history?type=topic_created")

    assert response.status_code == 200
    assert all(a["activity_type"] == "topic_created" for a in response.json()["activities"])


async def test_study_stats_reflects_recorded_activity(authed_client: AsyncClient):
    await authed_client.post("/api/v1/topics", json={"title": "New Topic"})

    response = await authed_client.get("/api/v1/study-history/stats")

    assert response.status_code == 200
    assert response.json()["stats"]["total_activities"] >= 1
