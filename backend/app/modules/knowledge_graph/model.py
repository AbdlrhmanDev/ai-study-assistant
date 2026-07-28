from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Float, ForeignKey, Identity, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base

RELATION_TYPES = ("prerequisite", "related", "contrasts", "part_of")


class ConceptRelation(Base):
    """A directed edge between two concepts -- reuses the existing
    `concepts` table (owned by the mastery module) rather than duplicating
    it, so the graph's node colors are always the same mastery scores
    Weakness Detection already tracks."""

    __tablename__ = "concept_relations"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    from_concept_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False
    )
    to_concept_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, server_default="0.7")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"relation_type IN {RELATION_TYPES}", name="concept_relations_type_check"),
        CheckConstraint("from_concept_id != to_concept_id", name="concept_relations_no_self_loop"),
        CheckConstraint("weight >= 0 AND weight <= 1", name="concept_relations_weight_range"),
        UniqueConstraint(
            "from_concept_id", "to_concept_id", "relation_type",
            name="uq_concept_relations_from_to_type",
        ),
        Index("concept_relations_from_concept_id_index", "from_concept_id"),
        Index("concept_relations_to_concept_id_index", "to_concept_id"),
    )
