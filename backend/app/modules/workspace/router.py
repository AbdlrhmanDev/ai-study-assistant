from fastapi import APIRouter, Query, Request, status

from ...api.dependencies import CurrentUser, DbSession
from ...core.config import get_settings
from ...core.security import ai_rate_limit_key, limiter
from ...shared.responses import no_content
from . import service
from .model import WorkspacePage
from .schema import (
    AskAiOnBlock,
    LinkWorkspacePageTopic,
    WorkspacePageCreate,
    WorkspacePageOut,
    WorkspacePageUpdate,
)

router = APIRouter(prefix="/workspace-pages", tags=["workspace"])

_settings = get_settings()


def _serialize(page: WorkspacePage) -> dict:
    return WorkspacePageOut.model_validate(page).model_dump(mode="json")


@router.get("")
async def list_pages(
    db: DbSession, user: CurrentUser, topic_id: int | None = Query(None, gt=0)
):
    pages = await service.list_pages(db, user["id"], topic_id)
    return {"pages": [_serialize(page) for page in pages]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_page(payload: WorkspacePageCreate, db: DbSession, user: CurrentUser):
    page = await service.create_page(db, user["id"], payload)
    return {"page": _serialize(page)}


@router.get("/{page_id}")
async def get_page(page_id: int, db: DbSession, user: CurrentUser):
    page = await service.get_page(db, page_id, user["id"])
    return {"page": _serialize(page)}


@router.patch("/{page_id}")
async def update_page(
    page_id: int, payload: WorkspacePageUpdate, db: DbSession, user: CurrentUser
):
    page = await service.update_page(db, page_id, user["id"], payload)
    return {"page": _serialize(page)}


@router.patch("/{page_id}/topic")
async def link_topic(
    page_id: int, payload: LinkWorkspacePageTopic, db: DbSession, user: CurrentUser
):
    page = await service.link_topic(db, page_id, user["id"], payload)
    return {"page": _serialize(page)}


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(page_id: int, db: DbSession, user: CurrentUser):
    await service.delete_page(db, page_id, user["id"])
    return no_content()


@router.post("/{page_id}/blocks/{block_id}/ask-ai")
@limiter.limit(f"{_settings.ai_rate_limit}/hour", key_func=ai_rate_limit_key)
async def ask_ai_on_block(
    request: Request,
    page_id: int,
    block_id: str,
    payload: AskAiOnBlock,
    db: DbSession,
    user: CurrentUser,
):
    answer, provider_name, model_name = await service.ask_ai_on_block(
        db, page_id, user["id"], block_id, payload.instruction
    )
    return {"result": {"answer": answer, "provider": provider_name, "model": model_name}}
