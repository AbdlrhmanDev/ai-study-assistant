from fastapi import APIRouter, status

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["mind-map"])


@router.get("/topics/{topic_id}/mind-map")
async def get_mind_map(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.get_mind_map(db, topic_id, user["id"])


@router.post("/topics/{topic_id}/mind-map/rebuild", status_code=status.HTTP_202_ACCEPTED)
async def rebuild_mind_map(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.request_mind_map_rebuild(db, topic_id, user["id"])
