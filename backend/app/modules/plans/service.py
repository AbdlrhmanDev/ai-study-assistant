from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ..users.model import User


async def get_user_plan(db: AsyncSession, user_id: int) -> str:
    """The plan slug for an account, falling back to the configured default
    when the column is empty (e.g. accounts created before the migration ran)."""
    plan = await db.scalar(select(User.plan).where(User.id == user_id))
    settings = get_settings()
    if not plan or plan not in settings.plan_tiers:
        return settings.default_plan
    return plan


def _resolve_tier(plan: str) -> dict:
    settings = get_settings()
    tier = settings.plan_tiers.get(plan)
    if tier is None:
        tier = settings.plan_tiers.get(settings.default_plan, {})
    return tier


def plan_limits(plan: str) -> dict:
    """Resolved quota definition for a plan: feature AI caps scaled from the
    deployment defaults, plus the plan's storage and monthly-request caps."""
    settings = get_settings()
    tier = _resolve_tier(plan)
    multiplier = max(0.0, float(tier.get("feature_multiplier", 1)))
    feature_limits: dict[str, dict[str, int]] = {}
    for feature, limits in settings.feature_limits.items():
        scaled: dict[str, int] = {}
        if "daily" in limits:
            scaled["daily"] = max(1, int(limits["daily"] * multiplier))
        if "monthly" in limits:
            scaled["monthly"] = max(1, int(limits["monthly"] * multiplier))
        if scaled:
            feature_limits[feature] = scaled
    return {
        "plan": plan,
        "label": tier.get("label", plan),
        "monthlyPriceUsd": float(tier.get("monthly_price_usd", 0)),
        "storageBytes": int(tier.get("storage_mb", 0)) * 1024 * 1024,
        "monthlyRequestLimit": int(tier.get("monthly_request_limit", settings.ai_monthly_request_limit)),
        "featureLimits": feature_limits,
    }


async def plan_limits_for_user(db: AsyncSession, user_id: int) -> dict:
    plan = await get_user_plan(db, user_id)
    return plan_limits(plan)
