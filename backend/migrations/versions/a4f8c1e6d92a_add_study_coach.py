"""add_study_coach

Revision ID: a4f8c1e6d92a
Revises: d8a1e5c93b7f
Create Date: 2026-07-28 15:00:00.000000

Adds AI Study Coach: per-topic `study_goals` (exam date + daily minute
budget), and daily `study_plans` / `study_plan_tasks` -- a ranked,
time-boxed task list generated from existing mastery data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4f8c1e6d92a'
down_revision: Union[str, Sequence[str], None] = 'd8a1e5c93b7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'study_goals',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('exam_date', sa.Date(), nullable=True),
        sa.Column('available_minutes_per_day', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            'available_minutes_per_day IS NULL OR available_minutes_per_day > 0',
            name='study_goals_minutes_positive',
        ),
        sa.UniqueConstraint('user_id', 'topic_id', name='uq_study_goals_user_id_topic_id'),
    )

    op.create_table(
        'study_plans',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_date', sa.Date(), nullable=False),
        sa.Column('narrative', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'plan_date', name='uq_study_plans_user_id_plan_date'),
    )
    op.create_index('study_plans_user_id_index', 'study_plans', ['user_id'])

    op.create_table(
        'study_plan_tasks',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('plan_id', sa.BigInteger(), sa.ForeignKey('study_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('concept_id', sa.BigInteger(), sa.ForeignKey('concepts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('estimated_minutes', sa.Integer(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('pending', 'completed', 'skipped')",
            name='study_plan_tasks_status_check',
        ),
    )
    op.create_index('study_plan_tasks_plan_id_index', 'study_plan_tasks', ['plan_id'])


def downgrade() -> None:
    op.drop_index('study_plan_tasks_plan_id_index', table_name='study_plan_tasks')
    op.drop_table('study_plan_tasks')
    op.drop_index('study_plans_user_id_index', table_name='study_plans')
    op.drop_table('study_plans')
    op.drop_table('study_goals')
