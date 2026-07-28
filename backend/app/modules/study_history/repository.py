from collections.abc import Sequence
from datetime import date

import structlog
from sqlalchemy import cast, func, select
from sqlalchemy.dialects.postgresql import DATE
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

from ..topics.model import Topic
from .model import StudyActivity

logger = structlog.get_logger("study_assistant")


async def create_activity(
    db: AsyncSession,
    *,
    user_id: int,
    topic_id: int | None,
    activity_type: str,
    description: str,
) -> StudyActivity:
    activity = StudyActivity(
        user_id=user_id, topic_id=topic_id, activity_type=activity_type, description=description
    )
    db.add(activity)
    await db.flush()
    return activity


async def record_activity_safely(
    db: AsyncSession,
    *,
    user_id: int,
    topic_id: int | None,
    activity_type: str,
    description: str,
) -> None:
    """Best-effort activity log: never let a logging failure break the
    primary operation (mirrors the Express app's `recordActivitySafely`)."""
    try:
        async with db.begin_nested():
            await create_activity(
                db,
                user_id=user_id,
                topic_id=topic_id,
                activity_type=activity_type,
                description=description,
            )
    except Exception:
        logger.warning("record_activity_failed", user_id=user_id, topic_id=topic_id, exc_info=True)


def _filters(user_id: int, activity_type: str | None, topic_id: int | None) -> list:
    clauses = [StudyActivity.user_id == user_id]
    if activity_type:
        clauses.append(StudyActivity.activity_type == activity_type)
    if topic_id:
        clauses.append(StudyActivity.topic_id == topic_id)
    return clauses


async def list_activities(
    db: AsyncSession,
    *,
    user_id: int,
    activity_type: str | None,
    topic_id: int | None,
    limit: int,
    offset: int,
) -> Sequence[RowMapping]:
    stmt = (
        select(
            StudyActivity.id,
            StudyActivity.topic_id,
            Topic.title.label("topic_title"),
            StudyActivity.activity_type,
            StudyActivity.description,
            StudyActivity.created_at,
        )
        .select_from(StudyActivity)
        .outerjoin(Topic, Topic.id == StudyActivity.topic_id)
        .where(*_filters(user_id, activity_type, topic_id))
        .order_by(StudyActivity.created_at.desc(), StudyActivity.id.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.mappings().all()


async def count_activities(
    db: AsyncSession, *, user_id: int, activity_type: str | None, topic_id: int | None
) -> int:
    stmt = (
        select(func.count(StudyActivity.id))
        .where(*_filters(user_id, activity_type, topic_id))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


async def count_activities_by_type(db: AsyncSession, user_id: int) -> dict[str, int]:
    stmt = (
        select(StudyActivity.activity_type, func.count(StudyActivity.id))
        .where(StudyActivity.user_id == user_id)
        .group_by(StudyActivity.activity_type)
    )
    result = await db.execute(stmt)
    return {activity_type: count for activity_type, count in result.all()}


async def daily_activity_counts(db: AsyncSession, user_id: int, since: date) -> dict[date, int]:
    """Activity counts grouped by calendar day since `since` (inclusive) --
    feeds the Analytics dashboard's trend chart."""
    day = cast(StudyActivity.created_at, DATE)
    stmt = (
        select(day.label("day"), func.count(StudyActivity.id))
        .where(StudyActivity.user_id == user_id, StudyActivity.created_at >= since)
        .group_by(day)
    )
    result = await db.execute(stmt)
    return {day_value: count for day_value, count in result.all()}


async def get_stats(db: AsyncSession, user_id: int) -> dict:
    stmt = select(
        func.count(StudyActivity.id).label("total_activities"),
        func.count(StudyActivity.id)
        .filter(StudyActivity.created_at >= func.date_trunc("week", func.now()))
        .label("activities_this_week"),
        func.count(StudyActivity.id)
        .filter(StudyActivity.activity_type == "ai_chat")
        .label("ai_interactions"),
        func.count(func.distinct(StudyActivity.topic_id)).label("topics_studied"),
    ).where(StudyActivity.user_id == user_id)
    result = await db.execute(stmt)
    return dict(result.mappings().one())
