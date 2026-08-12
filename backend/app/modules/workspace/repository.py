from sqlalchemy import Select, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import WorkspacePage, WorkspacePageVersion


def _owned_query(user_id: int) -> Select:
    return select(WorkspacePage).where(WorkspacePage.user_id == user_id)


# Safety cap -- with topic_id=None this lists every page a user owns across
# every topic, which grows unbounded as they create pages over time.
_PAGE_LIST_CAP = 500


async def list_for_user(
    db: AsyncSession, user_id: int, topic_id: int | None = None
) -> list[WorkspacePage]:
    stmt = _owned_query(user_id)
    if topic_id is not None:
        stmt = stmt.where(WorkspacePage.topic_id == topic_id)
    stmt = stmt.order_by(WorkspacePage.updated_at.desc(), WorkspacePage.id.desc()).limit(
        _PAGE_LIST_CAP
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id_for_user(db: AsyncSession, page_id: int, user_id: int) -> WorkspacePage | None:
    stmt = _owned_query(user_id).where(WorkspacePage.id == page_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession, *, user_id: int, title: str, topic_id: int | None
) -> WorkspacePage:
    page = WorkspacePage(user_id=user_id, title=title, topic_id=topic_id, blocks=[])
    db.add(page)
    await db.flush()
    await db.refresh(page)
    return page


async def update(
    db: AsyncSession, page: WorkspacePage, *, title: str | None, blocks: list[dict] | None
) -> WorkspacePage:
    if title is not None:
        page.title = title
    if blocks is not None:
        page.blocks = blocks
    await db.flush()
    await db.refresh(page)
    return page


async def set_topic(db: AsyncSession, page: WorkspacePage, topic_id: int | None) -> WorkspacePage:
    page.topic_id = topic_id
    await db.flush()
    await db.refresh(page)
    return page


async def delete(db: AsyncSession, page: WorkspacePage) -> None:
    await db.delete(page)


# --------------------------------------------------------------------------
# Version history / recovery snapshots
# --------------------------------------------------------------------------

# Keep a bounded trail per page -- recovery snapshots, not a full audit log.
MAX_VERSIONS_PER_PAGE = 50


async def get_latest_version(db: AsyncSession, workspace_page_id: int) -> WorkspacePageVersion | None:
    stmt = (
        select(WorkspacePageVersion)
        .where(WorkspacePageVersion.workspace_page_id == workspace_page_id)
        .order_by(WorkspacePageVersion.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_version(
    db: AsyncSession, *, workspace_page_id: int, title: str, blocks: list[dict]
) -> WorkspacePageVersion:
    version = WorkspacePageVersion(workspace_page_id=workspace_page_id, title=title, blocks=blocks)
    db.add(version)
    await db.flush()

    # Prune anything past the cap, oldest first.
    stale_ids_stmt = (
        select(WorkspacePageVersion.id)
        .where(WorkspacePageVersion.workspace_page_id == workspace_page_id)
        .order_by(WorkspacePageVersion.created_at.desc())
        .offset(MAX_VERSIONS_PER_PAGE)
    )
    stale_ids = (await db.execute(stale_ids_stmt)).scalars().all()
    if stale_ids:
        await db.execute(delete(WorkspacePageVersion).where(WorkspacePageVersion.id.in_(stale_ids)))

    await db.refresh(version)
    return version


async def list_versions_for_page(
    db: AsyncSession, workspace_page_id: int
) -> list[WorkspacePageVersion]:
    stmt = (
        select(WorkspacePageVersion)
        .where(WorkspacePageVersion.workspace_page_id == workspace_page_id)
        .order_by(WorkspacePageVersion.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_version_for_page(
    db: AsyncSession, version_id: int, workspace_page_id: int
) -> WorkspacePageVersion | None:
    stmt = select(WorkspacePageVersion).where(
        WorkspacePageVersion.id == version_id,
        WorkspacePageVersion.workspace_page_id == workspace_page_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
