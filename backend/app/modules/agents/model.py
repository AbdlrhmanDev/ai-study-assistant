from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

AGENT_TYPES = (
    "orchestrator", "tutor", "planner", "quiz_generator", "exam_generator", "flashcard_generator", "researcher",
)
SESSION_STATUSES = ("completed", "failed")


class AgentSession(Base):
    """One dispatched request and its outcome -- the audit trail behind the
    "Agent trace" UI. `goal` is the student's original free-text request."""

    __tablename__ = "agent_sessions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=True
    )
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="completed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"status IN {SESSION_STATUSES}", name="agent_sessions_status_check"),
        Index("agent_sessions_user_id_index", "user_id"),
    )


class AgentStep(Base):
    """One hop within a session -- e.g. step 0 is always the orchestrator's
    classification, step 1 is the dispatched specialist's action."""

    __tablename__ = "agent_steps"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    session_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_type: Mapped[str] = mapped_column(String(30), nullable=False)
    tool_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input: Mapped[str] = mapped_column(Text, nullable=False)
    output: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"agent_type IN {AGENT_TYPES}", name="agent_steps_agent_type_check"),
        Index("agent_steps_session_id_index", "session_id"),
    )
