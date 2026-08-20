from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.mastery import service as mastery_service
from app.modules.topics.model import Topic
from app.modules.users.model import User


async def test_overview_for_new_user_is_all_zeros(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/analytics/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["totalActivities"] == 0
    assert body["currentStreak"] == 0
    assert body["totalXp"] == 0
    assert body["overallLevelName"] == "Novice"
    assert len(body["activityTrend"]) == 7
    assert body["mastery"] == {
        "totalConcepts": 0, "averageMastery": None, "weakCount": 0, "strongCount": 0,
    }
    assert body["weakestConcepts"] == []
    assert body["topics"] == []


async def test_dashboard_overview_aggregates_home_data(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/dashboard/overview")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "analytics", "flashcards", "flashcardsByTopic", "topics", "todayPlan", "goals", "noteCounts"
    }
    assert body["analytics"]["totalActivities"] == 0
    assert body["topics"] == []
    assert body["flashcardsByTopic"] == []
    assert body["noteCounts"] == {}


async def test_overview_reflects_topic_and_mastery_data(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = Topic(user_id=test_user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="Photosynthesis",
        source_type="quiz", source_id=1, quality=1.0,
    )
    await db_session.commit()

    response = await authed_client.get("/api/v1/analytics/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["mastery"]["totalConcepts"] == 1
    assert len(body["topics"]) == 1
    assert body["topics"][0]["topicId"] == topic.id
    assert body["topics"][0]["conceptCount"] == 1
