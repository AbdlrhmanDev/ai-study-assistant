from fastapi import APIRouter

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/me")
async def my_plan(db: DbSession, user: CurrentUser):
    """The caller's resolved plan and its quota limits. Billing is not wired
    up yet, so there is nothing to purchase -- this is read-only status."""
    return service.plan_limits(await service.get_user_plan(db, int(user["id"])))
