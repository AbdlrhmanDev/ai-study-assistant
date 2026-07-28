from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

MEMORY_TYPES = ("strength", "weakness", "preference", "fact")


class StudentMemory(Base):
    """A durable fact the AI has learned about a student, consulted by the
    AI Tutor's prompt builder before answering (and, later, the Study
    Coach). Extraction is best-effort and runs as a background task after
    a chat exchange -- see memory/indexing.py."""

    __tablename__ = "student_memory"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    memory_type: Mapped[str] = mapped_column(String(20), nullable=False)
    key: Mapped[str] = mapped_column(String(200), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.5")
    reinforcement_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    last_reinforced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"memory_type IN {MEMORY_TYPES}", name="student_memory_type_check"),
        CheckConstraint("char_length(trim(value)) > 0", name="student_memory_value_not_empty"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="student_memory_confidence_range_check"),
        UniqueConstraint("user_id", "key", name="uq_student_memory_user_id_key"),
        Index("student_memory_user_id_index", "user_id"),
    )
