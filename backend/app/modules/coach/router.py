from datetime import date

from fastapi import APIRouter

from ...api.dependencies import CurrentUser, DbSession
from . import service
from .schema import StudyGoalIn, TaskStatusIn

router = APIRouter(tags=["coach"])


@router.get("/topics/{topic_id}/study-goal")
async def get_study_goal(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.get_study_goal(db, topic_id, user["id"])


@router.put("/topics/{topic_id}/study-goal")
async def set_study_goal(topic_id: int, payload: StudyGoalIn, db: DbSession, user: CurrentUser):
    return await service.set_study_goal(
        db, topic_id, user["id"], payload.examDate, payload.availableMinutesPerDay
    )


@router.get("/coach/plan/today")
async def get_today_plan(db: DbSession, user: CurrentUser):
    return await service.get_today_plan(db, user["id"])


@router.post("/coach/plan/regenerate")
async def regenerate_plan(db: DbSession, user: CurrentUser):
    return await service.regenerate_today_plan(db, user["id"])


@router.patch("/study-plan-tasks/{task_id}")
async def update_task_status(task_id: int, payload: TaskStatusIn, db: DbSession, user: CurrentUser):
    return await service.update_task_status(db, task_id, user["id"], payload.status)


@router.get("/coach/reflection/{plan_date}")
async def get_reflection(plan_date: date, db: DbSession, user: CurrentUser):
    return await service.get_reflection(db, user["id"], plan_date)
