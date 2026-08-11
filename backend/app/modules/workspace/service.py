from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import provider as ai_provider
from ..topics import service as topics_service
from . import repository
from .exceptions import WorkspaceBlockNotFoundError, WorkspacePageConflictError, WorkspacePageNotFoundError
from .model import WorkspacePage
from .schema import LinkWorkspacePageTopic, WorkspacePageCreate, WorkspacePageUpdate

WORKSPACE_AI_INSTRUCTIONS = (
    "You are a concise study assistant helping a student edit notes inside a "
    "block-based page editor. Respond directly and only to the instruction, "
    "using the block's current content as context. Keep the answer focused "
    "-- a short paragraph unless the instruction specifically asks for a list."
)


def _find_block_dict(blocks: list[dict], block_id: str) -> dict | None:
    for block in blocks:
        if block.get("id") == block_id:
            return block
        found = _find_block_dict(block.get("children") or [], block_id)
        if found is not None:
            return found
    return None


async def get_owned_page_or_404(db: AsyncSession, page_id: int, user_id: int) -> WorkspacePage:
    page = await repository.get_by_id_for_user(db, page_id, user_id)
    if page is None:
        raise WorkspacePageNotFoundError()
    return page


async def list_pages(db: AsyncSession, user_id: int, topic_id: int | None) -> list[WorkspacePage]:
    return await repository.list_for_user(db, user_id, topic_id)


async def create_page(
    db: AsyncSession, user_id: int, payload: WorkspacePageCreate
) -> WorkspacePage:
    if payload.topic_id is not None:
        await topics_service.get_owned_topic_or_404(db, payload.topic_id, user_id)
    page = await repository.create(
        db, user_id=user_id, title=payload.title, topic_id=payload.topic_id
    )
    await db.commit()
    await db.refresh(page)
    return page


async def get_page(db: AsyncSession, page_id: int, user_id: int) -> WorkspacePage:
    return await get_owned_page_or_404(db, page_id, user_id)


async def update_page(
    db: AsyncSession, page_id: int, user_id: int, payload: WorkspacePageUpdate
) -> WorkspacePage:
    page = await get_owned_page_or_404(db, page_id, user_id)
    if payload.expectedUpdatedAt is not None:
        # Compare parsed instants, not raw strings -- Pydantic's JSON
        # serializer (what the client actually received and echoes back)
        # renders a UTC offset as "Z", while Python's datetime.isoformat()
        # renders it as "+00:00"; a string compare would false-positive on
        # every single request.
        try:
            expected = datetime.fromisoformat(payload.expectedUpdatedAt.replace("Z", "+00:00"))
        except ValueError:
            expected = None
        if expected != page.updated_at:
            raise WorkspacePageConflictError({
                "id": page.id, "title": page.title, "blocks": page.blocks,
                "updatedAt": page.updated_at.isoformat(),
            })
    blocks_dump = None
    if payload.blocks is not None:
        blocks_dump = [block.model_dump(mode="json") for block in payload.blocks]
    page = await repository.update(db, page, title=payload.title, blocks=blocks_dump)
    await db.commit()
    await db.refresh(page)
    return page


async def link_topic(
    db: AsyncSession, page_id: int, user_id: int, payload: LinkWorkspacePageTopic
) -> WorkspacePage:
    page = await get_owned_page_or_404(db, page_id, user_id)
    if payload.topic_id is not None:
        await topics_service.get_owned_topic_or_404(db, payload.topic_id, user_id)
    page = await repository.set_topic(db, page, payload.topic_id)
    await db.commit()
    await db.refresh(page)
    return page


async def delete_page(db: AsyncSession, page_id: int, user_id: int) -> None:
    page = await get_owned_page_or_404(db, page_id, user_id)
    await repository.delete(db, page)
    await db.commit()


async def ask_ai_on_block(
    db: AsyncSession, page_id: int, user_id: int, block_id: str, instruction: str
) -> tuple[str, str, str]:
    """Read-only: answers a question about one block's content. Does not
    write anything -- the frontend decides whether to insert/replace the
    answer via the normal blocks-PATCH autosave path."""
    page = await get_owned_page_or_404(db, page_id, user_id)
    block = _find_block_dict(page.blocks or [], block_id)
    if block is None:
        raise WorkspaceBlockNotFoundError()

    content = (block.get("content") or "").strip() or "(this block is empty)"
    prompt = f"BLOCK CONTENT:\n{content}\n\nINSTRUCTION:\n{instruction}"
    return await ai_provider.generate(prompt, instructions=WORKSPACE_AI_INSTRUCTIONS)
