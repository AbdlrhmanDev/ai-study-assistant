from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Index, String, Text, desc, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base


class StudyActivity(Base):
    __tablename__ = "study_activities"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True
    )
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "activity_type IN ('topic_created','topic_updated','note_created',"
            "'note_updated','note_moved','ai_chat','flashcard_created',"
            "'flashcards_generated','quiz_generated','quiz_completed',"
            "'flashcard_reviewed','diagnosis_viewed','knowledge_graph_viewed','mind_map_viewed')",
            name="study_activities_type_check",
        ),
        CheckConstraint(
            "char_length(trim(description)) > 0", name="study_activities_description_not_empty"
        ),
        Index("study_activities_user_created_at_index", "user_id", desc("created_at")),
        Index("study_activities_topic_id_index", "topic_id"),
    )
