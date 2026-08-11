from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Identity, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class CleanupRun(Base):
    """Audit trail for scheduled retention/cleanup sweeps -- proves the
    Privacy Policy's retention commitments (docs/legal/DATA_RETENTION.md)
    are actually enforced, without recording anything about *what* was
    deleted beyond counts (never object keys, emails, or content)."""

    __tablename__ = "cleanup_runs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    sweep_type: Mapped[str] = mapped_column(String(50), nullable=False)
    counts: Mapped[dict] = mapped_column(JSONB, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
