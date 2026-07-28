from fastapi import APIRouter

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["mind-map"])


@router.get("/topics/{topic_id}/mind-map")
async def get_mind_map(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.get_mind_map(db, topic_id, user["id"])


@router.post("/topics/{topic_id}/mind-map/rebuild")
async def rebuild_mind_map(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.rebuild_mind_map(db, topic_id, user["id"])
