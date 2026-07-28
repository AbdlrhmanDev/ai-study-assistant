"""add_gamification

Revision ID: d8a1e5c93b7f
Revises: f27d94b6a3c5
Create Date: 2026-07-28 14:00:00.000000

Adds Gamification core: an append-only `xp_events` ledger, per-(user,topic)
`user_levels` derived from accumulated XP, and a platform-wide daily
`user_streaks` row per user.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8a1e5c93b7f'
down_revision: Union[str, Sequence[str], None] = 'f27d94b6a3c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'xp_events',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='CASCADE'), nullable=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('source_type', sa.String(length=30), nullable=False),
        sa.Column('source_id', sa.BigInteger(), nullable=True),
        sa.Column('description', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('amount > 0', name='xp_events_amount_positive'),
        sa.CheckConstraint(
            "source_type IN ('quiz', 'flashcard', 'sparring', 'mastery_milestone')",
            name='xp_events_source_type_check',
        ),
    )
    op.create_index('xp_events_user_id_index', 'xp_events', ['user_id'])
    op.create_index('xp_events_user_topic_index', 'xp_events', ['user_id', 'topic_id'])

    op.create_table(
        'user_levels',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('total_xp', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('total_xp >= 0', name='user_levels_total_xp_non_negative'),
        sa.UniqueConstraint('user_id', 'topic_id', name='uq_user_levels_user_id_topic_id'),
    )
    op.create_index('user_levels_user_id_index', 'user_levels', ['user_id'])

    op.create_table(
        'user_streaks',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('current_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('longest_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_active_date', sa.Date(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('current_streak >= 0', name='user_streaks_current_non_negative'),
        sa.CheckConstraint('longest_streak >= 0', name='user_streaks_longest_non_negative'),
    )


def downgrade() -> None:
    op.drop_table('user_streaks')
    op.drop_index('user_levels_user_id_index', table_name='user_levels')
    op.drop_table('user_levels')
    op.drop_index('xp_events_user_topic_index', table_name='xp_events')
    op.drop_index('xp_events_user_id_index', table_name='xp_events')
    op.drop_table('xp_events')
