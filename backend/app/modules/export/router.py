from typing import Literal

from fastapi import APIRouter, Response

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["export"])


def _file_response(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/topics/{topic_id}/notes/export")
async def export_notes(
    topic_id: int, db: DbSession, user: CurrentUser, format: Literal["csv", "md"] = "csv"
):
    content, media_type, filename = await service.export_notes(db, topic_id, user["id"], format)
    return _file_response(content, media_type, filename)


@router.get("/topics/{topic_id}/flashcards/export")
async def export_flashcards(
    topic_id: int, db: DbSession, user: CurrentUser, format: Literal["csv"] = "csv"
):
    content, media_type, filename = await service.export_flashcards(db, topic_id, user["id"], format)
    return _file_response(content, media_type, filename)


@router.get("/reports/progress")
async def export_progress_report(db: DbSession, user: CurrentUser, format: Literal["pdf", "csv"] = "pdf"):
    content, media_type, filename = await service.export_progress_report(db, user["id"], format)
    return _file_response(content, media_type, filename)
