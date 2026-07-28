from fastapi import APIRouter, Query

from ...api.dependencies import CurrentUser, DbSession
from ...shared.types import ActivityType
from . import service

router = APIRouter(prefix="/study-history", tags=["study-history"])


@router.get("")
async def list_study_history(
    db: DbSession,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: ActivityType | None = None,
    topicId: int | None = Query(None, gt=0),
):
    return await service.get_study_history(
        db, user["id"], page=page, limit=limit, activity_type=type, topic_id=topicId
    )


@router.get("/stats")
async def study_stats(db: DbSession, user: CurrentUser):
    return {"stats": await service.get_study_stats(db, user["id"])}
