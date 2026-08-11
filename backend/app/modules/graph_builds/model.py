from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

BUILD_TYPES = ("knowledge_graph", "mind_map")


class TopicBuildStatus(Base):
    """Tracks whether an async rebuild (knowledge graph or mind map) is in
    flight for a topic, independent of the actual content tables -- a
    rebuild in progress doesn't hide the previous successful result, and
    both build types share one small table instead of each content table
    growing job-tracking columns of its own."""

    __tablename__ = "topic_build_status"

    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True
    )
    build_type: Mapped[str] = mapped_column(String(30), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="completed")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"build_type IN {BUILD_TYPES}", name="topic_build_status_type_check"),
        CheckConstraint(
            "status IN ('pending','processing','completed','failed')",
            name="topic_build_status_status_check",
        ),
    )
