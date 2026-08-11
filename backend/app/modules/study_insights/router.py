from fastapi import APIRouter, Query

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["study insights"])


@router.get("/study-insights")
async def get_summary(db: DbSession, user: CurrentUser):
    return await service.summary(db, user["id"])


@router.get("/mistakes")
async def get_mistakes(db: DbSession, user: CurrentUser, limit: int = Query(50, ge=1, le=100)):
    return {"mistakes": await service.list_mistakes(db, user["id"], limit)}


@router.get("/weekly-report")
async def get_weekly_report(db: DbSession, user: CurrentUser):
    return await service.weekly_report(db, user["id"])


_EMPTY_SEARCH_RESULTS = {
    "topics": [], "notes": [], "documents": [], "workspacePages": [], "quizzes": [], "exams": [], "flashcards": [],
}


@router.get("/study-search")
async def study_search(q: str, db: DbSession, user: CurrentUser):
    return await service.search(db, user["id"], q) if q.strip() else dict(_EMPTY_SEARCH_RESULTS)
