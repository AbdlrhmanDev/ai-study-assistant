from fastapi import APIRouter, BackgroundTasks, File, Form, Query, Request, UploadFile, status

from ...api.dependencies import CurrentUser, DbSession
from ...core.config import get_settings
from ...core.security import ai_rate_limit_key, limiter
from ...shared.responses import no_content
from . import service
from .model import Document
from .schema import ChatIn, DocumentOut

router = APIRouter(tags=["ai"])

_settings = get_settings()


@router.post("/topics/{topic_id}/ai/chat", status_code=status.HTTP_201_CREATED)
@limiter.limit(f"{_settings.ai_rate_limit}/hour", key_func=ai_rate_limit_key)
async def chat_with_tutor(
    topic_id: int,
    payload: ChatIn,
    request: Request,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
):
    if payload.mode == "sparring":
        return await service.spar_with_tutor(
            db, topic_id, user["id"], payload.question, payload.concept,
            spar_start=payload.sparStart, background_tasks=background_tasks,
        )
    return await service.chat_with_tutor(
        db, topic_id, user["id"], payload.question,
        document_id=payload.documentId, background_tasks=background_tasks,
    )


@router.post("/topics/{topic_id}/ai/chat/image", status_code=status.HTTP_201_CREATED)
@limiter.limit(f"{_settings.ai_rate_limit}/hour", key_func=ai_rate_limit_key)
async def chat_with_tutor_image(
    topic_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
    question: str = Form(""),
):
    raw_bytes = await file.read()
    return await service.chat_with_tutor_image(
        db, topic_id, user["id"], question, raw_bytes,
        file.content_type or "application/octet-stream", background_tasks=background_tasks,
    )


@router.get("/topics/{topic_id}/ai/messages")
async def get_message_history(
    topic_id: int,
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(20, ge=1, le=50),
):
    messages = await service.get_message_history(db, topic_id, user["id"], limit)
    return {"messages": messages}


@router.delete("/topics/{topic_id}/ai/messages")
async def clear_message_history(topic_id: int, db: DbSession, user: CurrentUser):
    deleted = await service.clear_message_history(db, topic_id, user["id"])
    return {"deletedCount": deleted}


def _serialize_document(document: Document) -> dict:
    return DocumentOut.model_validate(document).model_dump(mode="json")


@router.post("/topics/{topic_id}/documents", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    topic_id: int,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
    title: str | None = Form(None),
):
    raw_bytes = await file.read()
    document = await service.create_document(
        db,
        background_tasks,
        topic_id,
        user["id"],
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        raw_bytes=raw_bytes,
        title=title,
    )
    return {"document": _serialize_document(document)}


@router.get("/topics/{topic_id}/documents")
async def list_documents(topic_id: int, db: DbSession, user: CurrentUser):
    documents = await service.list_documents(db, topic_id, user["id"])
    return {"documents": [_serialize_document(document) for document in documents]}


@router.get("/documents/{document_id}")
async def get_document(document_id: int, db: DbSession, user: CurrentUser):
    document = await service.get_document(db, document_id, user["id"])
    return {"document": _serialize_document(document)}


@router.post("/documents/{document_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_document(document_id: int, db: DbSession, user: CurrentUser):
    document = await service.retry_document_index(db, document_id, user["id"])
    return {"document": _serialize_document(document)}


@router.get("/documents/{document_id}/download-url")
async def document_download_url(document_id: int, db: DbSession, user: CurrentUser):
    return {"url": await service.get_document_download_url(db, document_id, user["id"])}


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: int, db: DbSession, user: CurrentUser):
    await service.delete_document(db, document_id, user["id"])
    return no_content()
