from fastapi import APIRouter, File, Header, Query, UploadFile, status

from ...api.dependencies import CurrentUser, DbSession
from ...core.idempotency import cache_artifact, get_cached_artifact, stable_artifact_key, with_idempotency
from ...shared.responses import no_content
from ..topics import service as topics_service
from . import service
from .model import Flashcard
from .schema import (
    DashboardStatsOut,
    DeckStatsOut,
    FlashcardArchiveIn,
    FlashcardBulkIn,
    FlashcardCreate,
    FlashcardGenerate,
    FlashcardOut,
    FlashcardReviewIn,
    FlashcardUpdate,
)

router = APIRouter(tags=["flashcards"])


def _scheduling_explanation(flashcard: Flashcard) -> dict:
    """Human-readable "why is this card due now" summary built from the SM-2
    state already persisted on the card."""
    if flashcard.repetitions == 0:
        stage = "new"
        reason = "New card — it has never been reviewed, so it is due immediately."
    elif flashcard.interval_days == 0:
        stage = "learning"
        reason = "In the learning phase — reviewed again today until the first successful rating starts the interval cycle."
    else:
        stage = "review"
        rating_note = (
            f"Your last rating was {flashcard.last_rating}" if flashcard.last_rating else "It was rated"
        )
        reviewed_note = (
            f" on {flashcard.last_reviewed_at.isoformat()}" if flashcard.last_reviewed_at else ""
        )
        reason = (
            f"{rating_note}{reviewed_note}; the interval grew to {flashcard.interval_days} day(s) "
            f"(ease factor {flashcard.ease_factor:.2f}), so it is due today."
        )
    return {
        "stage": stage,
        "intervalDays": flashcard.interval_days,
        "easeFactor": round(flashcard.ease_factor, 2),
        "dueAt": flashcard.due_at.isoformat(),
        "reason": reason,
    }


def _serialize(entry: tuple[Flashcard, str | None, str | None]) -> dict:
    flashcard, source_type, source_title = entry
    data = FlashcardOut.model_validate(flashcard).model_dump(mode="json")
    data["sourceType"] = source_type
    data["sourceTitle"] = source_title
    data["scheduling"] = _scheduling_explanation(flashcard)
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
async def generate_flashcards(
    topic_id: int, payload: FlashcardGenerate, db: DbSession, user: CurrentUser,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    async def _compute() -> dict:
        signature = await topics_service.material_signature(db, topic_id, user["id"])
        cache_key = stable_artifact_key("flashcards", topic_id, signature, payload.model_dump())
        cached = await get_cached_artifact(user["id"], "flashcards", cache_key)
        if cached is not None:
            return cached
        entries = await service.generate_flashcards(db, topic_id, user["id"], payload)
        response = {"flashcards": [_serialize(entry) for entry in entries]}
        await cache_artifact(user["id"], "flashcards", cache_key, response)
        return response

    return await with_idempotency(user["id"], "flashcards_generate", idempotency_key, _compute)


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


@router.get("/topics/{topic_id}/flashcards/deck-health")
async def get_deck_health(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.get_deck_health(db, topic_id, user["id"])


@router.post("/topics/{topic_id}/flashcards/import", status_code=status.HTTP_201_CREATED)
async def import_flashcards(topic_id: int, db: DbSession, user: CurrentUser, file: UploadFile = File(...)):
    raw_bytes = await file.read()
    return await service.import_flashcards(db, topic_id, user["id"], raw_bytes)


@router.post("/topics/{topic_id}/flashcards/bulk")
async def bulk_update_flashcards(topic_id: int, payload: FlashcardBulkIn, db: DbSession, user: CurrentUser):
    updated = await service.bulk_update_flashcards(db, topic_id, user["id"], payload.flashcardIds, payload.action)
    return {"updated": updated}


@router.get("/flashcards/due")
async def get_due_queue(db: DbSession, user: CurrentUser, limit: int = Query(50, ge=1, le=200)):
    entries = await service.get_due_queue_for_user(db, user["id"], limit)
    return {"flashcards": [_serialize(entry) for entry in entries]}


@router.get("/flashcards/stats-summary")
async def get_dashboard_stats(db: DbSession, user: CurrentUser):
    stats = await service.get_dashboard_stats(db, user["id"])
    return DashboardStatsOut(**stats).model_dump(mode="json")


@router.get("/flashcards/stats-by-topic")
async def get_deck_stats_for_user(db: DbSession, user: CurrentUser):
    stats = await service.get_deck_stats_for_user(db, user["id"])
    return {"stats": [DeckStatsOut(**entry).model_dump(mode="json") for entry in stats]}


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
