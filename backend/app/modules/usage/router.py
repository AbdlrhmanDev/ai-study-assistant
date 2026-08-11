from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from ...api.dependencies import CurrentUser, DbSession
from ...core.admin import AdminUser
from .model import UsageEvent
from . import service

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/me")
async def my_usage(user: CurrentUser):
    return await service.get_usage_summary(int(user["id"]))


def _date_range(from_date: str | None, to_date: str | None) -> tuple[datetime, datetime]:
    start = (
        datetime.combine(date.fromisoformat(from_date), time.min, tzinfo=timezone.utc)
        if from_date else datetime(2020, 1, 1, tzinfo=timezone.utc)
    )
    end = (
        datetime.combine(date.fromisoformat(to_date), time.max, tzinfo=timezone.utc)
        if to_date else datetime.now(timezone.utc)
    )
    return start, end


@router.get("/admin/summary")
async def admin_summary(
    db: DbSession, _admin: AdminUser,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    group_by: str = Query("feature", alias="groupBy"),
):
    start, end = _date_range(from_date, to_date)
    group_column = {
        "user": UsageEvent.user_id, "feature": UsageEvent.feature, "provider": UsageEvent.provider,
    }.get(group_by, UsageEvent.feature)

    rows = (await db.execute(
        select(
            group_column, UsageEvent.provider, UsageEvent.feature, func.count(UsageEvent.id),
            func.sum(UsageEvent.input_tokens + UsageEvent.output_tokens),
            func.avg(UsageEvent.latency_ms), func.sum(UsageEvent.estimated_cost_usd),
            func.sum(UsageEvent.retries), func.sum(UsageEvent.fallbacks),
        )
        .where(UsageEvent.created_at >= start, UsageEvent.created_at <= end)
        .group_by(group_column, UsageEvent.provider, UsageEvent.feature)
        .order_by(func.sum(UsageEvent.estimated_cost_usd).desc())
    )).all()
    return {"usage": [
        {
            "groupKey": r[0], "provider": r[1], "feature": r[2], "requests": r[3],
            "tokens": int(r[4] or 0), "averageLatencyMs": round(float(r[5] or 0), 1),
            "estimatedCostUsd": round(float(r[6] or 0), 4), "retries": int(r[7] or 0), "fallbacks": int(r[8] or 0),
        }
        for r in rows
    ]}


@router.get("/admin/failures")
async def admin_failures(
    db: DbSession, _admin: AdminUser,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
):
    start, end = _date_range(from_date, to_date)
    rows = (await db.execute(
        select(
            UsageEvent.feature, UsageEvent.outcome, func.count(UsageEvent.id),
        )
        .where(UsageEvent.created_at >= start, UsageEvent.created_at <= end)
        .group_by(UsageEvent.feature, UsageEvent.outcome)
    )).all()

    by_feature: dict[str, dict[str, int]] = {}
    for feature, outcome, count in rows:
        by_feature.setdefault(feature, {"success": 0, "failed": 0})[outcome] = int(count)

    return {"failures": [
        {
            "feature": feature,
            "success": counts.get("success", 0),
            "failed": counts.get("failed", 0),
            "failureRate": round(
                counts.get("failed", 0) / max(1, counts.get("success", 0) + counts.get("failed", 0)), 4
            ),
        }
        for feature, counts in sorted(by_feature.items())
    ]}


@router.get("/admin/top-cost")
async def admin_top_cost(
    db: DbSession, _admin: AdminUser,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    limit: int = Query(10, ge=1, le=100),
):
    start, end = _date_range(from_date, to_date)

    users = (await db.execute(
        select(UsageEvent.user_id, func.sum(UsageEvent.estimated_cost_usd))
        .where(UsageEvent.created_at >= start, UsageEvent.created_at <= end, UsageEvent.user_id.isnot(None))
        .group_by(UsageEvent.user_id)
        .order_by(func.sum(UsageEvent.estimated_cost_usd).desc())
        .limit(limit)
    )).all()
    features = (await db.execute(
        select(UsageEvent.feature, func.sum(UsageEvent.estimated_cost_usd))
        .where(UsageEvent.created_at >= start, UsageEvent.created_at <= end)
        .group_by(UsageEvent.feature)
        .order_by(func.sum(UsageEvent.estimated_cost_usd).desc())
        .limit(limit)
    )).all()
    return {
        "topUsers": [{"userId": r[0], "estimatedCostUsd": round(float(r[1] or 0), 4)} for r in users],
        "topFeatures": [{"feature": r[0], "estimatedCostUsd": round(float(r[1] or 0), 4)} for r in features],
    }
