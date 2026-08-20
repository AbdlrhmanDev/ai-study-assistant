from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Identity, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class ProductEvent(Base):
    __tablename__ = "product_events"
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    properties: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    __table_args__ = (
        Index("product_events_name_created_index", "name", "created_at"),
        Index("product_events_user_created_index", "user_id", "created_at"),
    )


class AnswerFeedback(Base):
    __tablename__ = "answer_feedback"
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(40))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        CheckConstraint("rating IN (-1, 1)", name="answer_feedback_rating_check"),
        UniqueConstraint("user_id", "message_id", name="answer_feedback_user_message_unique"),
        Index("answer_feedback_created_index", "created_at"),
    )


class ReminderPreference(Base):
    __tablename__ = "reminder_preferences"
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    hour_local: Mapped[int] = mapped_column(Integer, nullable=False, server_default="18")
    timezone: Mapped[str] = mapped_column(String(80), nullable=False, server_default="UTC")
    minimum_due_cards: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        CheckConstraint("hour_local BETWEEN 0 AND 23", name="reminder_preferences_hour_check"),
        CheckConstraint("minimum_due_cards >= 1", name="reminder_preferences_minimum_due_check"),
    )


class ReminderDelivery(Base):
    __tablename__ = "reminder_deliveries"
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reminder_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    due_cards: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    __table_args__ = (
        CheckConstraint("status IN ('sent','failed','skipped')", name="reminder_deliveries_status_check"),
        UniqueConstraint("user_id", "reminder_date", name="reminder_deliveries_user_date_unique"),
    )
