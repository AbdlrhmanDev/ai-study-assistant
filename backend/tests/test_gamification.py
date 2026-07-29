from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def test_get_topic_level_defaults_to_novice(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/level")

    assert response.status_code == 200
    body = response.json()
    assert body["levelName"] == "Novice"
    assert body["totalXp"] == 0
    assert body["nextLevelName"] == "Apprentice"


async def test_get_topic_level_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/level")

    assert response.status_code == 404


async def test_get_streak_defaults_to_zero(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/streak")

    assert response.status_code == 200
    body = response.json()
    assert body["currentStreak"] == 0
    assert body["longestStreak"] == 0
    assert body["lastActiveDate"] is None


async def test_award_quiz_xp_increases_topic_level(db_session: AsyncSession, test_user: User):
    from app.modules.gamification import service as gamification_service

    topic = await _create_topic(db_session, test_user)

    result = await gamification_service.award_quiz_xp(
        db_session, user_id=test_user.id, topic_id=topic.id, difficulty_score=1.0, source_id=1
    )
    await db_session.commit()

    assert result.xp_awarded > 0
    progress = await gamification_service.get_topic_progress(db_session, topic.id, test_user.id)
    assert progress["totalXp"] == result.xp_awarded


async def test_record_graded_action_starts_streak(db_session: AsyncSession, test_user: User):
    from app.modules.gamification import service as gamification_service

    await gamification_service.record_graded_action(db_session, test_user.id)
    await db_session.commit()

    streak = await gamification_service.get_streak(db_session, test_user.id)
    assert streak["currentStreak"] == 1
