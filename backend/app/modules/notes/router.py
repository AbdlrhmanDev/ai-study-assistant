from fastapi import APIRouter, BackgroundTasks, Query, status

from ...api.dependencies import CurrentUser, DbSession
from ...shared.responses import no_content
from . import service
from .model import Note
from .schema import MoveNote, NoteCreate, NoteOut, NoteUpdate

router = APIRouter(tags=["notes"])


def _serialize(note: Note) -> dict:
    return NoteOut.model_validate(note).model_dump(mode="json")


@router.get("/topics/{topic_id}/notes/paginated")
async def paginated_notes(
    topic_id: int,
    db: DbSession,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    result = await service.get_paginated_notes(db, topic_id, user["id"], page, limit)
    return {"notes": [_serialize(note) for note in result["notes"]], "pagination": result["pagination"]}


@router.get("/topics/{topic_id}/notes/search")
async def search_notes(
    topic_id: int,
    db: DbSession,
    user: CurrentUser,
    search: str = Query(min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    result = await service.search_notes(db, topic_id, user["id"], search, page, limit)
    return {"notes": [_serialize(note) for note in result["notes"]], "pagination": result["pagination"]}


@router.get("/topics/{topic_id}/notes")
async def list_notes(topic_id: int, db: DbSession, user: CurrentUser):
    notes = await service.list_notes(db, topic_id, user["id"])
    return {"notes": [_serialize(note) for note in notes]}


@router.post("/topics/{topic_id}/notes", status_code=status.HTTP_201_CREATED)
async def create_note(
    topic_id: int,
    payload: NoteCreate,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
):
    note = await service.create_note(db, background_tasks, topic_id, user["id"], payload)
    return {"note": _serialize(note)}


@router.patch("/notes/{note_id}/move")
async def move_note(note_id: int, payload: MoveNote, db: DbSession, user: CurrentUser):
    note = await service.move_note(db, note_id, user["id"], payload)
    return {"note": _serialize(note)}


@router.get("/notes/{note_id}")
async def get_note(note_id: int, db: DbSession, user: CurrentUser):
    note = await service.get_note(db, note_id, user["id"])
    return {"note": _serialize(note)}


@router.patch("/notes/{note_id}")
async def update_note(
    note_id: int,
    payload: NoteUpdate,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
):
    note = await service.update_note(db, background_tasks, note_id, user["id"], payload)
    return {"note": _serialize(note)}


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: int, db: DbSession, user: CurrentUser):
    await service.delete_note(db, note_id, user["id"])
    return no_content()
