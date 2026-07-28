from fastapi import APIRouter

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["analytics"])


@router.get("/analytics/overview")
async def get_overview(db: DbSession, user: CurrentUser):
    return await service.get_overview(db, user["id"])
