"""add_knowledge_graph

Revision ID: f3a8d21c6e97
Revises: e91f4a76b0c3
Create Date: 2026-07-28 18:00:00.000000

Adds Knowledge Graph: `concept_relations` (directed edges between existing
`concepts` rows -- reuses that table rather than duplicating it). Also
widens `study_activities`' allowed types to add `flashcard_reviewed`,
`diagnosis_viewed`, and `knowledge_graph_viewed`, needed for the upcoming
Learning Style Detection feature's engagement signals.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a8d21c6e97'
down_revision: Union[str, Sequence[str], None] = 'e91f4a76b0c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_TYPES = (
    "'topic_created','topic_updated','note_created',"
    "'note_updated','note_moved','ai_chat','flashcard_created',"
    "'flashcards_generated','quiz_generated','quiz_completed'"
)
_NEW_TYPES = _OLD_TYPES + ",'flashcard_reviewed','diagnosis_viewed','knowledge_graph_viewed'"


def upgrade() -> None:
    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check', 'study_activities', f"activity_type IN ({_NEW_TYPES})",
    )

    op.create_table(
        'concept_relations',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('from_concept_id', sa.BigInteger(), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('to_concept_id', sa.BigInteger(), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('relation_type', sa.String(length=20), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False, server_default='0.7'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "relation_type IN ('prerequisite', 'related', 'contrasts', 'part_of')",
            name='concept_relations_type_check',
        ),
        sa.CheckConstraint('from_concept_id != to_concept_id', name='concept_relations_no_self_loop'),
        sa.CheckConstraint('weight >= 0 AND weight <= 1', name='concept_relations_weight_range'),
        sa.UniqueConstraint(
            'from_concept_id', 'to_concept_id', 'relation_type',
            name='uq_concept_relations_from_to_type',
        ),
    )
    op.create_index('concept_relations_from_concept_id_index', 'concept_relations', ['from_concept_id'])
    op.create_index('concept_relations_to_concept_id_index', 'concept_relations', ['to_concept_id'])


def downgrade() -> None:
    op.drop_index('concept_relations_to_concept_id_index', table_name='concept_relations')
    op.drop_index('concept_relations_from_concept_id_index', table_name='concept_relations')
    op.drop_table('concept_relations')

    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check', 'study_activities', f"activity_type IN ({_OLD_TYPES})",
    )
