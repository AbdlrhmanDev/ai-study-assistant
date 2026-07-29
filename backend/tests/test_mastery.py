from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.mastery import service as mastery_service
from app.modules.topics.model import Topic
from app.modules.users.model import User
from httpx import AsyncClient


async def _create_topic(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def test_record_mastery_event_creates_concept_and_mastery(
    db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    result = await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="Photosynthesis",
        source_type="quiz", source_id=1, quality=1.0,
    )
    await db_session.commit()

    assert result.mastery is not None
    assert result.mastery.mastery_score > 0


async def test_record_mastery_event_ignores_blank_concept(db_session: AsyncSession, test_user: User):
    topic = await _create_topic(db_session, test_user)

    result = await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="   ",
        source_type="quiz", source_id=1, quality=1.0,
    )

    assert result.mastery is None
    assert result.milestone_award is None


async def test_list_weak_concepts_orders_by_lowest_mastery(db_session: AsyncSession, test_user: User):
    topic = await _create_topic(db_session, test_user)
    await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="Strong Concept",
        source_type="quiz", source_id=1, quality=1.0,
    )
    await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="Weak Concept",
        source_type="quiz", source_id=2, quality=0.0,
    )
    await db_session.commit()

    concepts = await mastery_service.list_weak_concepts(db_session, topic.id, test_user.id)

    assert [c["conceptName"] for c in concepts] == ["Weak Concept", "Strong Concept"]


async def test_list_weak_concepts_unowned_topic_raises(db_session: AsyncSession, other_user: User):
    from app.core.exceptions import AppError
    import pytest

    topic = await _create_topic(db_session, other_user)

    with pytest.raises(AppError) as excinfo:
        await mastery_service.list_weak_concepts(db_session, topic.id, 999999)

    assert excinfo.value.status_code == 404


async def test_get_concept_history_endpoint_returns_events(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    result = await mastery_service.record_mastery_event(
        db_session, user_id=test_user.id, topic_id=topic.id, concept_name="Photosynthesis",
        source_type="quiz", source_id=1, quality=1.0,
    )
    await db_session.commit()
    concept_id = result.mastery.concept_id

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/mastery/{concept_id}/history")

    assert response.status_code == 200
    body = response.json()
    assert len(body["events"]) == 1
    assert body["events"][0]["sourceType"] == "quiz"


async def test_get_concept_history_missing_concept_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/mastery/999999/history")

    assert response.status_code == 404
