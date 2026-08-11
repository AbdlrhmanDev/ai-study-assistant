from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

JOB_STATUSES = ("queued", "running", "completed", "failed", "dead")


class BackgroundJob(Base):
    """Durable record of a Redis-queued job's lifecycle, for admin
    visibility (dead-letter inspection, retry/discard), atomic status
    transitions, idempotency-key dedup, and stuck-job recovery. Redis stays
    the fast BRPOP transport; this table is the source of truth for state,
    the same way `usage_events` is the source of truth for AI usage."""

    __tablename__ = "background_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="queued")
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="4")
    # Nullable, deliberately NOT unique: dedup only looks at queued/running
    # rows with this key (see repository.get_by_idempotency_key), so a
    # completed/failed/dead job never permanently blocks a later legitimate
    # retry from reusing the same key.
    idempotency_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"status IN {JOB_STATUSES}", name="background_jobs_status_check"),
        Index("background_jobs_status_index", "status"),
        Index("background_jobs_status_created_at_index", "status", "created_at"),
        Index("background_jobs_idempotency_key_index", "idempotency_key"),
    )
