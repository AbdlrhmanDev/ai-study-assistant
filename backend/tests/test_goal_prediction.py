from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.mastery import service as mastery_service
from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def test_prediction_with_no_mastery_data_returns_no_data_status(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    # STATUS_NO_DATA short-circuits before any AI call, so no mocking needed.
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/goal-prediction")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "no_data"
    assert body["readiness"] is None


async def test_prediction_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/goal-prediction")

    assert response.status_code == 404


async def test_prediction_with_mastery_but_no_exam_date_returns_no_deadline(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate("You're making good progress.")
    topic = await _create_topic(db_session, test_user)
    await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="Photosynthesis",
        source_type="quiz", source_id=1, quality=0.9,
    )
    await db_session.commit()

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/goal-prediction")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "no_deadline"
    assert body["readiness"] is not None


async def test_prediction_with_exam_date_returns_days_remaining(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate("You're on track, keep it up.")
    topic = await _create_topic(db_session, test_user)
    await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="Photosynthesis",
        source_type="quiz", source_id=1, quality=1.0,
    )
    await db_session.commit()
    exam_date = date.today() + timedelta(days=10)
    await authed_client.put(
        f"/api/v1/topics/{topic.id}/study-goal", json={"examDate": exam_date.isoformat()}
    )

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/goal-prediction")

    assert response.status_code == 200
    body = response.json()
    assert body["daysRemaining"] == 10
    assert body["status"] in ("on_track", "at_risk", "behind")


async def test_list_predictions_empty_without_goals(authed_client: AsyncClient):
    response = await authed_client.get("/api/v1/goal-predictions")

    assert response.status_code == 200
    assert response.json()["predictions"] == []


async def test_list_predictions_includes_topics_with_exam_dates(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate("You're on track, keep it up.")
    topic = await _create_topic(db_session, test_user)
    exam_date = date.today() + timedelta(days=5)
    await authed_client.put(
        f"/api/v1/topics/{topic.id}/study-goal", json={"examDate": exam_date.isoformat()}
    )

    response = await authed_client.get("/api/v1/goal-predictions")

    assert response.status_code == 200
    predictions = response.json()["predictions"]
    assert len(predictions) == 1
    assert predictions[0]["topicId"] == topic.id
