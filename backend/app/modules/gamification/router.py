from fastapi import APIRouter

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["gamification"])


@router.get("/topics/{topic_id}/level")
async def get_topic_level(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.get_topic_progress(db, topic_id, user["id"])


@router.get("/streak")
async def get_streak(db: DbSession, user: CurrentUser):
    return await service.get_streak(db, user["id"])
