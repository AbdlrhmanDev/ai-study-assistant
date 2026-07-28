from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import UserLevel, UserStreak, XpEvent


async def add_xp_event(
    db: AsyncSession,
    *,
    user_id: int,
    topic_id: int | None,
    amount: int,
    source_type: str,
    source_id: int | None,
    description: str,
) -> XpEvent:
    event = XpEvent(
        user_id=user_id, topic_id=topic_id, amount=amount,
        source_type=source_type, source_id=source_id, description=description,
    )
    db.add(event)
    await db.flush()
    return event


async def has_milestone_event(
    db: AsyncSession, user_id: int, concept_mastery_id: int, milestone: float
) -> bool:
    stmt = select(XpEvent.id).where(
        XpEvent.user_id == user_id,
        XpEvent.source_type == "mastery_milestone",
        XpEvent.source_id == concept_mastery_id,
        XpEvent.description.like(f"%{int(milestone * 100)}%"),
    )
    result = await db.execute(stmt)
    return result.first() is not None


async def get_or_create_level(db: AsyncSession, user_id: int, topic_id: int) -> UserLevel:
    stmt = select(UserLevel).where(UserLevel.user_id == user_id, UserLevel.topic_id == topic_id)
    result = await db.execute(stmt)
    level = result.scalar_one_or_none()
    if level is not None:
        return level
    level = UserLevel(user_id=user_id, topic_id=topic_id, total_xp=0)
    db.add(level)
    await db.flush()
    return level


async def add_xp_to_level(db: AsyncSession, level: UserLevel, amount: int) -> UserLevel:
    level.total_xp += amount
    await db.flush()
    return level


async def get_level(db: AsyncSession, user_id: int, topic_id: int) -> UserLevel | None:
    stmt = select(UserLevel).where(UserLevel.user_id == user_id, UserLevel.topic_id == topic_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_levels_for_user(db: AsyncSession, user_id: int) -> list[UserLevel]:
    """Every per-topic level row for a user -- the Analytics dashboard sums
    these for a platform-wide total XP figure, since XP is tracked per topic."""
    stmt = select(UserLevel).where(UserLevel.user_id == user_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_or_create_streak(db: AsyncSession, user_id: int) -> UserStreak:
    stmt = select(UserStreak).where(UserStreak.user_id == user_id)
    result = await db.execute(stmt)
    streak = result.scalar_one_or_none()
    if streak is not None:
        return streak
    streak = UserStreak(user_id=user_id, current_streak=0, longest_streak=0, last_active_date=None)
    db.add(streak)
    await db.flush()
    return streak


async def update_streak(
    db: AsyncSession, streak: UserStreak, *, current_streak: int, longest_streak: int, last_active_date
) -> UserStreak:
    streak.current_streak = current_streak
    streak.longest_streak = longest_streak
    streak.last_active_date = last_active_date
    await db.flush()
    return streak
