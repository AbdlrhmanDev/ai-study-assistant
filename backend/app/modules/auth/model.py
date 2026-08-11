from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class UserSession(Base):
    """Server-side session store (mirrors Express's connect-pg-simple table).

    The primary key is the SHA-256 hex digest of the session cookie token, not
    the raw token, so a database leak (backup, log line) can't be replayed as
    a live session cookie.
    """

    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Approximate device/activity info for the account-security "active
    # sessions" list -- populated best-effort on session writes (see
    # SessionMiddleware); nullable because older/never-touched-again rows
    # predate this and legitimate anonymous sessions have no user_id anyway.
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("user_sessions_expires_at_index", "expires_at"),
        Index("user_sessions_user_id_index", "user_id"),
    )
