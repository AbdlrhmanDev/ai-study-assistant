from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import LearningStyleProfile


async def get_profile(db: AsyncSession, user_id: int) -> LearningStyleProfile | None:
    stmt = select(LearningStyleProfile).where(LearningStyleProfile.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_profile(db: AsyncSession, user_id: int) -> LearningStyleProfile:
    profile = LearningStyleProfile(user_id=user_id)
    db.add(profile)
    await db.flush()
    return profile


async def get_or_create_profile(db: AsyncSession, user_id: int) -> LearningStyleProfile:
    profile = await get_profile(db, user_id)
    if profile is not None:
        return profile
    return await create_profile(db, user_id)


async def save_computed(
    db: AsyncSession,
    profile: LearningStyleProfile,
    *,
    weights: dict[str, float],
    event_count: int,
    rationale: str | None,
    computed_at: datetime,
) -> LearningStyleProfile:
    profile.visual = weights["visual"]
    profile.reading = weights["reading"]
    profile.practice = weights["practice"]
    profile.flashcards = weights["flashcards"]
    profile.examples = weights["examples"]
    profile.conversation = weights["conversation"]
    profile.event_count = event_count
    profile.rationale = rationale
    profile.computed_at = computed_at
    await db.flush()
    await db.refresh(profile)
    return profile


async def save_override(
    db: AsyncSession, profile: LearningStyleProfile, *, weights: dict[str, float]
) -> LearningStyleProfile:
    profile.visual = weights["visual"]
    profile.reading = weights["reading"]
    profile.practice = weights["practice"]
    profile.flashcards = weights["flashcards"]
    profile.examples = weights["examples"]
    profile.conversation = weights["conversation"]
    profile.overridden = True
    profile.rationale = "Manually set by you."
    await db.flush()
    await db.refresh(profile)
    return profile
