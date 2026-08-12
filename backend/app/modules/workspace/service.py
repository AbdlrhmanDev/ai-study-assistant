from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import indexing as ai_indexing
from ..ai import provider as ai_provider
from ..topics import service as topics_service
from . import repository
from .exceptions import (
    WorkspaceBlockNotFoundError,
    WorkspacePageConflictError,
    WorkspacePageNotFoundError,
    WorkspacePageVersionNotFoundError,
)
from .model import WorkspacePage, WorkspacePageVersion
from .schema import (
    LinkWorkspacePageTopic,
    WorkspacePageCreate,
    WorkspacePageImport,
    WorkspacePageUpdate,
    validate_block_tree,
)

# Recovery snapshots are opportunistic, not per-keystroke: a new version is
# only recorded if the last one for this page is older than this, so rapid
# autosave doesn't flood the history with near-duplicate snapshots.
SNAPSHOT_MIN_INTERVAL = timedelta(minutes=5)

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


def serialize_export(page: WorkspacePage) -> dict:
    """Full-page payload for the standalone workspace export. Includes the
    block tree, which the account-level export deliberately omits."""
    return {
        "id": page.id,
        "topicId": page.topic_id,
        "title": page.title,
        "blocks": page.blocks or [],
        "updatedAt": page.updated_at.isoformat(),
    }


async def import_pages(
    db: AsyncSession, user_id: int, payload: WorkspacePageImport
) -> list[WorkspacePage]:
    """Recreate pages from an export payload. Topic references are validated
    up-front so a bad topic fails the whole import atomically (nothing is
    committed) instead of leaving a half-imported batch."""
    topic_ids = {item.topicId for item in payload.pages if item.topicId is not None}
    for topic_id in topic_ids:
        await topics_service.get_owned_topic_or_404(db, topic_id, user_id)

    created = []
    for item in payload.pages:
        blocks = validate_block_tree(item.blocks)
        page = await repository.create(db, user_id=user_id, title=item.title, topic_id=item.topicId)
        page = await repository.update(
            db, page, title=item.title, blocks=[block.model_dump(mode="json") for block in blocks]
        )
        created.append(page)
    await db.commit()
    for page in created:
        await ai_indexing.enqueue_workspace_page_index(page.id)
    return created


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


async def _maybe_snapshot(db: AsyncSession, page: WorkspacePage) -> None:
    """Records the page's state as it was *before* the update about to be
    applied -- only if enough time has passed since the last snapshot, or
    none exists yet."""
    latest = await repository.get_latest_version(db, page.id)
    now = datetime.now(timezone.utc)
    if latest is not None and (now - latest.created_at) < SNAPSHOT_MIN_INTERVAL:
        return
    await repository.create_version(
        db, workspace_page_id=page.id, title=page.title, blocks=page.blocks
    )


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
        await _maybe_snapshot(db, page)
    page = await repository.update(db, page, title=payload.title, blocks=blocks_dump)
    await db.commit()
    await db.refresh(page)
    if blocks_dump is not None:
        await ai_indexing.enqueue_workspace_page_index(page.id)
    return page


async def list_versions(db: AsyncSession, page_id: int, user_id: int) -> list[WorkspacePageVersion]:
    await get_owned_page_or_404(db, page_id, user_id)
    return await repository.list_versions_for_page(db, page_id)


async def get_version(db: AsyncSession, page_id: int, version_id: int, user_id: int) -> WorkspacePageVersion:
    await get_owned_page_or_404(db, page_id, user_id)
    version = await repository.get_version_for_page(db, version_id, page_id)
    if version is None:
        raise WorkspacePageVersionNotFoundError()
    return version


async def restore_version(
    db: AsyncSession, page_id: int, version_id: int, user_id: int
) -> WorkspacePage:
    page = await get_owned_page_or_404(db, page_id, user_id)
    version = await repository.get_version_for_page(db, version_id, page_id)
    if version is None:
        raise WorkspacePageVersionNotFoundError()

    # The current state is itself worth keeping -- restoring is undoable too.
    await repository.create_version(
        db, workspace_page_id=page.id, title=page.title, blocks=page.blocks
    )
    page = await repository.update(db, page, title=version.title, blocks=version.blocks)
    await db.commit()
    await db.refresh(page)
    await ai_indexing.enqueue_workspace_page_index(page.id)
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
    await ai_indexing.enqueue_workspace_page_index(page.id)
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
