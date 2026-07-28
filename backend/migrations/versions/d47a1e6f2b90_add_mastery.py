"""add_mastery

Revision ID: d47a1e6f2b90
Revises: c58e2a917d3b
Create Date: 2026-07-28 10:00:00.000000

Adds Weakness Detection: `concepts` (canonical, resolved from free-text
labels already produced by quiz/flashcard generation), `concept_mastery`
(one row per user+concept, decay-at-read-time), and `mastery_events`
(append-only signal log). Also adds `flashcards.concept` so flashcard
reviews can feed the same mastery rows as quiz answers.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd47a1e6f2b90'
down_revision: Union[str, Sequence[str], None] = 'c58e2a917d3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'concepts',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("char_length(trim(name)) > 0", name=op.f('concepts_name_not_empty')),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.id'], name=op.f('fk_concepts_topic_id_topics'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_concepts')),
    )
    op.create_index('concepts_topic_id_index', 'concepts', ['topic_id'], unique=False)

    op.create_table(
        'concept_mastery',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('concept_id', sa.BigInteger(), nullable=False),
        sa.Column('mastery_score', sa.Float(), server_default='0', nullable=False),
        sa.Column('confidence_score', sa.Float(), server_default='0', nullable=False),
        sa.Column('event_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('decay_rate', sa.Float(), server_default='0.02', nullable=False),
        sa.Column('last_assessed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_concept_mastery_user_id_users'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['concept_id'], ['concepts.id'], name=op.f('fk_concept_mastery_concept_id_concepts'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_concept_mastery')),
        sa.UniqueConstraint('user_id', 'concept_id', name=op.f('uq_concept_mastery_user_id_concept_id')),
    )
    op.create_index('concept_mastery_user_id_index', 'concept_mastery', ['user_id'], unique=False)
    op.create_index('concept_mastery_concept_id_index', 'concept_mastery', ['concept_id'], unique=False)

    op.create_table(
        'mastery_events',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('concept_mastery_id', sa.BigInteger(), nullable=False),
        sa.Column('source_type', sa.String(length=20), nullable=False),
        sa.Column('source_id', sa.BigInteger(), nullable=True),
        sa.Column('quality', sa.Float(), nullable=False),
        sa.Column('delta', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "source_type IN ('quiz', 'exam', 'flashcard', 'sparring')",
            name=op.f('mastery_events_source_type_check'),
        ),
        sa.CheckConstraint("quality >= 0 AND quality <= 1", name=op.f('mastery_events_quality_range_check')),
        sa.ForeignKeyConstraint(['concept_mastery_id'], ['concept_mastery.id'], name=op.f('fk_mastery_events_concept_mastery_id_concept_mastery'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_mastery_events')),
    )
    op.create_index('mastery_events_concept_mastery_id_index', 'mastery_events', ['concept_mastery_id'], unique=False)

    op.add_column('flashcards', sa.Column('concept', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('flashcards', 'concept')

    op.drop_index('mastery_events_concept_mastery_id_index', table_name='mastery_events')
    op.drop_table('mastery_events')

    op.drop_index('concept_mastery_concept_id_index', table_name='concept_mastery')
    op.drop_index('concept_mastery_user_id_index', table_name='concept_mastery')
    op.drop_table('concept_mastery')

    op.drop_index('concepts_topic_id_index', table_name='concepts')
    op.drop_table('concepts')
