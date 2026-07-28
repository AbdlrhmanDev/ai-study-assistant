"""add_learning_style

Revision ID: a2c6f9e0d4b1
Revises: f3a8d21c6e97
Create Date: 2026-07-28 19:00:00.000000

Adds Learning Style Detection: `learning_style_profile`, one row per user
holding six modality weights (visual/reading/practice/flashcards/examples/
conversation) inferred purely from engagement activity counts -- no LLM
involved in the scoring itself.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2c6f9e0d4b1'
down_revision: Union[str, Sequence[str], None] = 'f3a8d21c6e97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'learning_style_profile',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('visual', sa.Float(), nullable=False, server_default='0.1667'),
        sa.Column('reading', sa.Float(), nullable=False, server_default='0.1667'),
        sa.Column('practice', sa.Float(), nullable=False, server_default='0.1667'),
        sa.Column('flashcards', sa.Float(), nullable=False, server_default='0.1667'),
        sa.Column('examples', sa.Float(), nullable=False, server_default='0.1665'),
        sa.Column('conversation', sa.Float(), nullable=False, server_default='0.1667'),
        sa.Column('event_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('overridden', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('rationale', sa.Text(), nullable=True),
        sa.Column('computed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('visual >= 0 AND visual <= 1', name='learning_style_visual_range'),
        sa.CheckConstraint('reading >= 0 AND reading <= 1', name='learning_style_reading_range'),
        sa.CheckConstraint('practice >= 0 AND practice <= 1', name='learning_style_practice_range'),
        sa.CheckConstraint('flashcards >= 0 AND flashcards <= 1', name='learning_style_flashcards_range'),
        sa.CheckConstraint('examples >= 0 AND examples <= 1', name='learning_style_examples_range'),
        sa.CheckConstraint('conversation >= 0 AND conversation <= 1', name='learning_style_conversation_range'),
    )


def downgrade() -> None:
    op.drop_table('learning_style_profile')
