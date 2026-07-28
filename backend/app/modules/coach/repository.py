from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .model import StudyGoal, StudyPlan, StudyPlanTask

# --------------------------------------------------------------------------
# Study goals
# --------------------------------------------------------------------------


async def upsert_study_goal(
    db: AsyncSession, *, user_id: int, topic_id: int, exam_date: date | None, available_minutes_per_day: int | None
) -> StudyGoal:
    stmt = (
        pg_insert(StudyGoal)
        .values(
            user_id=user_id, topic_id=topic_id,
            exam_date=exam_date, available_minutes_per_day=available_minutes_per_day,
        )
        .on_conflict_do_update(
            index_elements=[StudyGoal.user_id, StudyGoal.topic_id],
            set_={"exam_date": exam_date, "available_minutes_per_day": available_minutes_per_day},
        )
        .returning(StudyGoal)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.scalar_one()


async def get_study_goal(db: AsyncSession, user_id: int, topic_id: int) -> StudyGoal | None:
    stmt = select(StudyGoal).where(StudyGoal.user_id == user_id, StudyGoal.topic_id == topic_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_goals(db: AsyncSession, user_id: int) -> list[StudyGoal]:
    stmt = select(StudyGoal).where(StudyGoal.user_id == user_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# --------------------------------------------------------------------------
# Plans + tasks
# --------------------------------------------------------------------------


async def get_plan_for_date(db: AsyncSession, user_id: int, plan_date: date) -> StudyPlan | None:
    stmt = select(StudyPlan).where(StudyPlan.user_id == user_id, StudyPlan.plan_date == plan_date)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def replace_plan_for_date(
    db: AsyncSession, *, user_id: int, plan_date: date, narrative: str
) -> StudyPlan:
    """Deletes any existing plan (and its tasks, via cascade) for this date
    and creates a fresh one -- used both for the first-ever generation and
    for explicit regeneration."""
    existing = await get_plan_for_date(db, user_id, plan_date)
    if existing is not None:
        await db.delete(existing)
        await db.flush()
    plan = StudyPlan(user_id=user_id, plan_date=plan_date, narrative=narrative)
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


async def create_task(
    db: AsyncSession,
    *,
    plan_id: int,
    topic_id: int,
    concept_id: int | None,
    title: str,
    estimated_minutes: int,
    order_index: int,
) -> StudyPlanTask:
    task = StudyPlanTask(
        plan_id=plan_id, topic_id=topic_id, concept_id=concept_id,
        title=title, estimated_minutes=estimated_minutes, order_index=order_index,
    )
    db.add(task)
    await db.flush()
    return task


async def list_tasks_for_plan(db: AsyncSession, plan_id: int) -> list[StudyPlanTask]:
    stmt = select(StudyPlanTask).where(StudyPlanTask.plan_id == plan_id).order_by(StudyPlanTask.order_index)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_task_for_user(db: AsyncSession, task_id: int, user_id: int) -> StudyPlanTask | None:
    stmt = (
        select(StudyPlanTask)
        .join(StudyPlan, StudyPlan.id == StudyPlanTask.plan_id)
        .where(StudyPlanTask.id == task_id, StudyPlan.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def set_task_status(db: AsyncSession, task: StudyPlanTask, status: str) -> StudyPlanTask:
    task.status = status
    await db.flush()
    await db.refresh(task)
    return task
