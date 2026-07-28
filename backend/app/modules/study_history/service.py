from sqlalchemy.ext.asyncio import AsyncSession

from ...shared.pagination import build_pagination_meta
from . import repository


async def get_study_history(
    db: AsyncSession,
    user_id: int,
    *,
    page: int,
    limit: int,
    activity_type: str | None,
    topic_id: int | None,
) -> dict:
    offset = (page - 1) * limit
    activities = await repository.list_activities(
        db,
        user_id=user_id,
        activity_type=activity_type,
        topic_id=topic_id,
        limit=limit,
        offset=offset,
    )
    total = await repository.count_activities(
        db, user_id=user_id, activity_type=activity_type, topic_id=topic_id
    )
    return {
        "activities": [dict(row) for row in activities],
        "pagination": build_pagination_meta(total, page, limit),
    }


async def get_study_stats(db: AsyncSession, user_id: int) -> dict:
    return await repository.get_stats(db, user_id)
