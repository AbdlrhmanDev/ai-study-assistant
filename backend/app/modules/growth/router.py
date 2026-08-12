from fastapi import APIRouter, Query, status

from ...api.dependencies import CurrentUser, DbSession
from ...core.admin import AdminUser
from . import service
from .schema import ProductEventIn, ReminderPreferenceIn

router = APIRouter(tags=["growth"])


@router.post("/product-events", status_code=status.HTTP_202_ACCEPTED)
async def create_product_event(payload: ProductEventIn, db: DbSession, user: CurrentUser):
    await service.record_event(db, user["id"], payload.name, payload.properties)
    return {"accepted": True}


@router.get("/reminders/preferences")
async def reminder_preferences(db: DbSession, user: CurrentUser):
    return service.serialize_preferences(await service.get_preferences(db, user["id"]))


@router.put("/reminders/preferences")
async def save_reminder_preferences(payload: ReminderPreferenceIn, db: DbSession, user: CurrentUser):
    value = await service.update_preferences(db, user["id"], email_enabled=payload.emailEnabled, hour_local=payload.hourLocal, timezone_name=payload.timezone, minimum_due_cards=payload.minimumDueCards)
    return service.serialize_preferences(value)


@router.get("/analytics/funnel")
async def analytics_funnel(db: DbSession, _admin: AdminUser, days: int = Query(30, ge=1, le=365)):
    return await service.funnel_summary(db, days)


@router.get("/analytics/retention")
async def analytics_retention(db: DbSession, _admin: AdminUser, weeks: int = Query(8, ge=2, le=52)):
    return await service.retention_summary(db, weeks)
