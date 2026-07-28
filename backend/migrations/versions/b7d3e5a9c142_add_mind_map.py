"""add_mind_map

Revision ID: b7d3e5a9c142
Revises: a2c6f9e0d4b1
Create Date: 2026-07-28 20:00:00.000000

Adds Mind Map Generator: `mind_maps`, one cached LLM-generated hierarchical
outline per topic. Also widens `study_activities`' allowed types to add
`mind_map_viewed`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b7d3e5a9c142'
down_revision: Union[str, Sequence[str], None] = 'a2c6f9e0d4b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_TYPES = (
    "'topic_created','topic_updated','note_created',"
    "'note_updated','note_moved','ai_chat','flashcard_created',"
    "'flashcards_generated','quiz_generated','quiz_completed',"
    "'flashcard_reviewed','diagnosis_viewed','knowledge_graph_viewed'"
)
_NEW_TYPES = _OLD_TYPES + ",'mind_map_viewed'"


def upgrade() -> None:
    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check', 'study_activities', f"activity_type IN ({_NEW_TYPES})",
    )

    op.create_table(
        'mind_maps',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('structure', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('mind_maps')

    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check', 'study_activities', f"activity_type IN ({_OLD_TYPES})",
    )
