from __future__ import annotations

import inspect
from contextvars import ContextVar
from datetime import datetime, timezone

from sqlalchemy import func, select

from ...core.config import get_settings
from ...core.exceptions import AppError
from ...db.session import get_sessionmaker
from . import pricing
from .model import UsageEvent

current_user_id: ContextVar[int | None] = ContextVar("usage_user_id", default=None)

FEATURES = {
    "flashcards": "flashcards", "quizzes": "quiz", "exams": "exam",
    "mind_map": "mind_map", "knowledge_graph": "knowledge_graph",
    "workspace": "workspace_ai", "agents": "agents", "coach": "coach",
    "memory": "memory", "goal_prediction": "goal_prediction",
    "learning_style": "learning_style", "ai": "chat",
}


def set_current_user(user_id: int) -> None:
    current_user_id.set(user_id)


def infer_feature() -> str:
    for frame in inspect.stack()[2:14]:
        module = frame.frame.f_globals.get("__name__", "")
        for key, feature in FEATURES.items():
            if f"modules.{key}." in module:
                return feature
    return "ai"


def _resolve_user_id(user_id: int | None) -> int | None:
    return user_id if user_id is not None else current_user_id.get()


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _day_start(now: datetime) -> datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


async def enforce_quota(feature: str | None = None, *, user_id: int | None = None) -> None:
    resolved_user_id = _resolve_user_id(user_id)
    if resolved_user_id is None:
        return
    resolved_feature = feature or infer_feature()
    now = datetime.now(timezone.utc)

    async with get_sessionmaker()() as db:
        plan_limits_for_account = await _plan_limits(db, resolved_user_id)
        feature_limits = plan_limits_for_account["featureLimits"]
        global_used = await db.scalar(
            select(func.count(UsageEvent.id)).where(
                UsageEvent.user_id == resolved_user_id, UsageEvent.created_at >= _month_start(now),
                UsageEvent.outcome == "success",
            )
        )
        global_limit = plan_limits_for_account["monthlyRequestLimit"]
        if int(global_used or 0) >= global_limit:
            raise AppError(
                "Your monthly AI beta limit has been reached. It resets next month.", 429,
                {"code": "AI_QUOTA_EXCEEDED", "scope": "global", "limit": global_limit, "used": int(global_used or 0)},
            )

        limits = feature_limits.get(resolved_feature, {})
        monthly_limit = limits.get("monthly")
        if monthly_limit is not None:
            feature_month_used = await db.scalar(
                select(func.count(UsageEvent.id)).where(
                    UsageEvent.user_id == resolved_user_id, UsageEvent.feature == resolved_feature,
                    UsageEvent.created_at >= _month_start(now), UsageEvent.outcome == "success",
                )
            )
            if int(feature_month_used or 0) >= monthly_limit:
                raise AppError(
                    f"Your monthly limit for this feature has been reached. It resets next month.", 429,
                    {
                        "code": "AI_QUOTA_EXCEEDED", "scope": "feature_monthly", "feature": resolved_feature,
                        "limit": monthly_limit, "used": int(feature_month_used or 0),
                    },
                )

        daily_limit = limits.get("daily")
        if daily_limit is not None:
            feature_day_used = await db.scalar(
                select(func.count(UsageEvent.id)).where(
                    UsageEvent.user_id == resolved_user_id, UsageEvent.feature == resolved_feature,
                    UsageEvent.created_at >= _day_start(now), UsageEvent.outcome == "success",
                )
            )
            if int(feature_day_used or 0) >= daily_limit:
                raise AppError(
                    "Your daily limit for this feature has been reached. It resets tomorrow.", 429,
                    {
                        "code": "AI_QUOTA_EXCEEDED", "scope": "feature_daily", "feature": resolved_feature,
                        "limit": daily_limit, "used": int(feature_day_used or 0),
                    },
                )


async def record(
    *, provider: str, model: str, prompt: str, output: str, latency_ms: int,
    image_bytes: int = 0, retries: int = 0, fallbacks: int = 0,
    outcome: str = "success", feature: str | None = None, user_id: int | None = None,
) -> None:
    resolved_user_id = _resolve_user_id(user_id)
    if resolved_user_id is None:
        # CLI maintenance and isolated provider tests have no account to meter.
        return
    # Provider SDK token metadata differs; this conservative estimator is durable
    # and can be replaced with exact SDK values without a schema migration.
    input_tokens = max(1, len(prompt) // 4)
    output_tokens = max(0, len(output) // 4)
    event = UsageEvent(
        user_id=resolved_user_id, feature=feature or infer_feature(), provider=provider, model=model,
        input_tokens=input_tokens, output_tokens=output_tokens, image_bytes=image_bytes,
        latency_ms=latency_ms, retries=retries, fallbacks=fallbacks,
        estimated_cost_usd=pricing.estimate_cost_usd(provider, model, input_tokens, output_tokens),
        prompt_version="v1", outcome=outcome,
    )
    async with get_sessionmaker()() as db:
        db.add(event)
        await db.commit()


async def _counts_by_feature(db, user_id: int, since: datetime) -> dict[str, int]:
    rows = await db.execute(
        select(UsageEvent.feature, func.count(UsageEvent.id))
        .where(UsageEvent.user_id == user_id, UsageEvent.created_at >= since, UsageEvent.outcome == "success")
        .group_by(UsageEvent.feature)
    )
    return {feature: int(count) for feature, count in rows}


async def _plan_limits(db, user_id: int) -> dict:
    from ..plans.service import plan_limits_for_user

    return await plan_limits_for_user(db, user_id)


async def get_usage_summary(user_id: int) -> dict:
    """Global + per-feature used/limit/remaining/softLimitHit, for
    `GET /usage/me` and any frontend quota display. Two grouped queries
    (month-to-date, day-to-date) instead of one per feature. Limits come
    from the account's plan tier."""
    now = datetime.now(timezone.utc)
    threshold = get_settings().soft_limit_warning_threshold

    async with get_sessionmaker()() as db:
        monthly_counts = await _counts_by_feature(db, user_id, _month_start(now))
        daily_counts = await _counts_by_feature(db, user_id, _day_start(now))
        plan_limits_for_account = await _plan_limits(db, user_id)

    global_used_int = sum(monthly_counts.values())
    global_limit = plan_limits_for_account["monthlyRequestLimit"]
    feature_limits = plan_limits_for_account["featureLimits"]

    features: dict[str, dict] = {}
    for feature, limits in feature_limits.items():
        entry: dict = {}
        monthly_limit = limits.get("monthly")
        daily_limit = limits.get("daily")
        if monthly_limit is not None:
            monthly_used = monthly_counts.get(feature, 0)
            entry["monthlyUsed"] = monthly_used
            entry["monthlyLimit"] = monthly_limit
            entry["monthlyRemaining"] = max(0, monthly_limit - monthly_used)
        if daily_limit is not None:
            daily_used = daily_counts.get(feature, 0)
            entry["dailyUsed"] = daily_used
            entry["dailyLimit"] = daily_limit
            entry["dailyRemaining"] = max(0, daily_limit - daily_used)
        entry["softLimitHit"] = any(
            entry.get(f"{window}Limit") and entry[f"{window}Used"] >= entry[f"{window}Limit"] * threshold
            for window in ("monthly", "daily") if f"{window}Limit" in entry
        )
        features[feature] = entry

    return {
        "used": global_used_int,
        "limit": global_limit,
        "remaining": max(0, global_limit - global_used_int),
        "softLimitHit": global_used_int >= global_limit * threshold,
        "warningThreshold": threshold,
        "features": features,
    }
