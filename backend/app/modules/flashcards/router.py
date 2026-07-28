from fastapi import APIRouter, Query, status

from ...api.dependencies import CurrentUser, DbSession
from ...shared.responses import no_content
from . import service
from .model import Flashcard
from .schema import (
    DashboardStatsOut,
    DeckStatsOut,
    FlashcardArchiveIn,
    FlashcardCreate,
    FlashcardGenerate,
    FlashcardOut,
    FlashcardReviewIn,
    FlashcardUpdate,
)

router = APIRouter(tags=["flashcards"])


def _serialize(entry: tuple[Flashcard, str | None, str | None]) -> dict:
    flashcard, source_type, source_title = entry
    data = FlashcardOut.model_validate(flashcard).model_dump(mode="json")
    data["sourceType"] = source_type
    data["sourceTitle"] = source_title
    return data


@router.get("/topics/{topic_id}/flashcards")
async def list_flashcards(
    topic_id: int,
    db: DbSession,
    user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
):
    entries = await service.list_flashcards(db, topic_id, user["id"], status_filter or "active")
    return {"flashcards": [_serialize(entry) for entry in entries]}


@router.post("/topics/{topic_id}/flashcards", status_code=status.HTTP_201_CREATED)
async def create_flashcard(topic_id: int, payload: FlashcardCreate, db: DbSession, user: CurrentUser):
    entry = await service.create_flashcard(db, topic_id, user["id"], payload)
    return {"flashcard": _serialize(entry)}


@router.post("/topics/{topic_id}/flashcards/generate", status_code=status.HTTP_201_CREATED)
async def generate_flashcards(topic_id: int, payload: FlashcardGenerate, db: DbSession, user: CurrentUser):
    entries = await service.generate_flashcards(db, topic_id, user["id"], payload)
    return {"flashcards": [_serialize(entry) for entry in entries]}


@router.get("/topics/{topic_id}/flashcards/due")
async def get_topic_due_queue(
    topic_id: int, db: DbSession, user: CurrentUser, limit: int = Query(50, ge=1, le=200)
):
    entries = await service.get_due_queue(db, topic_id, user["id"], limit)
    return {"flashcards": [_serialize(entry) for entry in entries]}


@router.get("/topics/{topic_id}/flashcards/stats")
async def get_deck_stats(topic_id: int, db: DbSession, user: CurrentUser):
    stats = await service.get_deck_stats(db, topic_id, user["id"])
    return DeckStatsOut(**stats).model_dump(mode="json")


@router.get("/flashcards/due")
async def get_due_queue(db: DbSession, user: CurrentUser, limit: int = Query(50, ge=1, le=200)):
    entries = await service.get_due_queue_for_user(db, user["id"], limit)
    return {"flashcards": [_serialize(entry) for entry in entries]}


@router.get("/flashcards/stats-summary")
async def get_dashboard_stats(db: DbSession, user: CurrentUser):
    stats = await service.get_dashboard_stats(db, user["id"])
    return DashboardStatsOut(**stats).model_dump(mode="json")


@router.patch("/flashcards/{flashcard_id}")
async def update_flashcard(flashcard_id: int, payload: FlashcardUpdate, db: DbSession, user: CurrentUser):
    entry = await service.update_flashcard(db, flashcard_id, user["id"], payload)
    return {"flashcard": _serialize(entry)}


@router.patch("/flashcards/{flashcard_id}/archive")
async def archive_flashcard(
    flashcard_id: int, payload: FlashcardArchiveIn, db: DbSession, user: CurrentUser
):
    entry = await service.set_flashcard_archived(db, flashcard_id, user["id"], payload.archived)
    return {"flashcard": _serialize(entry)}


@router.post("/flashcards/{flashcard_id}/review")
async def review_flashcard(
    flashcard_id: int, payload: FlashcardReviewIn, db: DbSession, user: CurrentUser
):
    entry, xp_summary = await service.review_flashcard(db, flashcard_id, user["id"], payload.rating)
    return {"flashcard": _serialize(entry), **xp_summary}


@router.post("/flashcards/{flashcard_id}/regenerate")
async def regenerate_flashcard(flashcard_id: int, db: DbSession, user: CurrentUser):
    entry = await service.regenerate_flashcard(db, flashcard_id, user["id"])
    return {"flashcard": _serialize(entry)}


@router.delete("/flashcards/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flashcard(flashcard_id: int, db: DbSession, user: CurrentUser):
    await service.delete_flashcard(db, flashcard_id, user["id"])
    return no_content()
