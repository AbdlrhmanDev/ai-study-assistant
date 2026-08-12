from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class WorkspacePage(Base):
    """A lightweight, Notion-style page: a freeform, ordered list of typed
    blocks (heading / text / checklist / link) the student edits inline.
    Lives at the top level, but can optionally link to one study topic so
    subject-specific resources stay easy to find."""

    __tablename__ = "workspace_pages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    blocks: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("char_length(trim(title)) > 0", name="workspace_pages_title_not_empty"),
        Index("workspace_pages_user_id_index", "user_id"),
        Index("workspace_pages_topic_id_index", "topic_id"),
    )


class WorkspacePageVersion(Base):
    """A point-in-time snapshot of a page, kept for recovery -- e.g. after an
    accidental bulk delete of blocks or a bad AI edit. Snapshots are taken
    opportunistically on save (see `workspace/service.py::_maybe_snapshot`),
    not on every autosave tick, so a page's edit history doesn't get
    pruned to noise."""

    __tablename__ = "workspace_page_versions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    workspace_page_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("workspace_pages.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    blocks: Mapped[list] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("workspace_page_versions_page_id_index", "workspace_page_id"),
    )
