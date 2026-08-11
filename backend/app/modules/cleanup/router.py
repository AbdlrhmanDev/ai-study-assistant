from fastapi import APIRouter

from ...core.admin import AdminUser
from . import service

router = APIRouter(prefix="/admin/cleanup", tags=["cleanup"])


@router.get("/runs")
async def recent_cleanup_runs(_admin: AdminUser):
    return {"runs": await service.list_recent_runs()}
