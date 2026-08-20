import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.dependencies import CurrentUser, DbSession
from ...core.config import get_settings
from ...db.session import get_sessionmaker
from ..analytics import service as analytics_service
from ..coach import service as coach_service
from ..flashcards import service as flashcards_service
from ..flashcards.schema import DashboardStatsOut, DeckStatsOut
from ..notes import repository as notes_repository
from ..topics import service as topics_service
from ..topics.schema import TopicOut

router = APIRouter(tags=["dashboard"])


async def _with_session(call: Callable[[AsyncSession], Awaitable[Any]]) -> Any:
    async with get_sessionmaker()() as session:
        return await call(session)


async def _load_parts(db: AsyncSession, user_id: int) -> tuple[Any, ...]:
    """Use independent sessions on PostgreSQL so the independent dashboard
    sections execute concurrently. SQLite (used by tests) keeps the shared
    request session because its transaction model does not support this.
    """
    bind = db.get_bind()
    if bind.dialect.name == "postgresql" and get_settings().node_env != "test":
        return await asyncio.gather(
            _with_session(lambda session: analytics_service.get_overview(session, user_id)),
            _with_session(lambda session: flashcards_service.get_dashboard_stats(session, user_id)),
            _with_session(lambda session: flashcards_service.get_deck_stats_for_user(session, user_id)),
            _with_session(lambda session: topics_service.list_topics(session, user_id)),
            _with_session(lambda session: coach_service.get_today_plan(session, user_id)),
            _with_session(lambda session: coach_service.list_goals(session, user_id)),
            _with_session(lambda session: notes_repository.count_by_topic_for_user(session, user_id)),
        )
    return (
        await analytics_service.get_overview(db, user_id),
        await flashcards_service.get_dashboard_stats(db, user_id),
        await flashcards_service.get_deck_stats_for_user(db, user_id),
        await topics_service.list_topics(db, user_id),
        await coach_service.get_today_plan(db, user_id),
        await coach_service.list_goals(db, user_id),
        await notes_repository.count_by_topic_for_user(db, user_id),
    )


@router.get("/dashboard/overview")
async def get_dashboard_overview(db: DbSession, user: CurrentUser):
    """Return everything needed for the home screen in one HTTP request.

    PostgreSQL work runs concurrently using independent sessions; sharing one
    AsyncSession between tasks would be unsafe. The browser now pays one round
    trip and can cache one consistent response.
    """
    user_id = user["id"]
    (
        analytics, flashcards, flashcards_by_topic, topics, today_plan, goals, note_counts
    ) = await _load_parts(db, user_id)

    return {
        "analytics": analytics,
        "flashcards": DashboardStatsOut(**flashcards).model_dump(mode="json"),
        "flashcardsByTopic": [
            DeckStatsOut(**entry).model_dump(mode="json") for entry in flashcards_by_topic
        ],
        "topics": [TopicOut.model_validate(topic).model_dump(mode="json") for topic in topics],
        "todayPlan": today_plan,
        "goals": [coach_service.serialize_goal(goal) for goal in goals],
        "noteCounts": note_counts,
    }
