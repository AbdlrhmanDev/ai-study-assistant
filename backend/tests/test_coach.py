from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Topic", description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def test_get_study_goal_defaults_when_unset(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/study-goal")

    assert response.status_code == 200
    body = response.json()
    assert body["examDate"] is None
    assert body["availableMinutesPerDay"] is None


async def test_set_study_goal_upserts(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    exam_date = (date.today() + timedelta(days=30)).isoformat()

    response = await authed_client.put(
        f"/api/v1/topics/{topic.id}/study-goal",
        json={"examDate": exam_date, "availableMinutesPerDay": 45},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["examDate"] == exam_date
    assert body["availableMinutesPerDay"] == 45


async def test_set_study_goal_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.put(
        f"/api/v1/topics/{topic.id}/study-goal", json={"availableMinutesPerDay": 30}
    )

    assert response.status_code == 404


async def test_get_today_plan_with_no_mastery_data_returns_empty_plan(authed_client: AsyncClient):
    # No concepts have mastery data yet, so ranking selects nothing and the
    # narrative falls back to a canned sentence -- this never calls the AI
    # provider, so no mocking is needed here.
    response = await authed_client.get("/api/v1/coach/plan/today")

    assert response.status_code == 200
    body = response.json()
    assert body["tasks"] == []
    assert "Nothing urgent" in body["narrative"]


async def test_get_today_plan_is_idempotent_within_the_same_day(authed_client: AsyncClient):
    first = await authed_client.get("/api/v1/coach/plan/today")
    second = await authed_client.get("/api/v1/coach/plan/today")

    assert first.json()["id"] == second.json()["id"]


async def test_update_task_status_changes_status(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    from app.modules.coach.model import StudyPlan, StudyPlanTask

    topic = await _create_topic(db_session, test_user)
    plan = StudyPlan(user_id=test_user.id, plan_date=date.today(), narrative="Test plan")
    db_session.add(plan)
    await db_session.flush()
    task = StudyPlanTask(
        plan_id=plan.id, topic_id=topic.id, concept_id=None, title="Review X",
        estimated_minutes=10, order_index=0,
    )
    db_session.add(task)
    await db_session.flush()

    response = await authed_client.patch(f"/api/v1/study-plan-tasks/{task.id}", json={"status": "completed"})

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


async def test_update_task_status_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    from app.modules.coach.model import StudyPlan, StudyPlanTask

    topic = await _create_topic(db_session, other_user)
    plan = StudyPlan(user_id=other_user.id, plan_date=date.today(), narrative="Test plan")
    db_session.add(plan)
    await db_session.flush()
    task = StudyPlanTask(
        plan_id=plan.id, topic_id=topic.id, concept_id=None, title="Review X",
        estimated_minutes=10, order_index=0,
    )
    db_session.add(task)
    await db_session.flush()

    response = await authed_client.patch(f"/api/v1/study-plan-tasks/{task.id}", json={"status": "completed"})

    assert response.status_code == 404


async def test_get_reflection_with_no_plan_returns_zero_state(authed_client: AsyncClient):
    response = await authed_client.get(f"/api/v1/coach/reflection/{date.today().isoformat()}")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["reflection"] is None
