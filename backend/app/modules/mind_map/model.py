from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class MindMap(Base):
    """One cached mind map per topic -- an LLM-generated hierarchical
    outline (root -> branches -> sub-branches), purely a visual/structural
    study aid. Unlike the Knowledge Graph, it isn't mastery-tracked and
    carries no per-user state, so one row per topic is enough."""

    __tablename__ = "mind_maps"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    structure: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
