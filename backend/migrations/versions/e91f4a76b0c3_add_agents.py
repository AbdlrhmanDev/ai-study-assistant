"""add_agents

Revision ID: e91f4a76b0c3
Revises: c7e2b9a15f34
Create Date: 2026-07-28 17:00:00.000000

Adds Multi-Agent AI: `agent_sessions` (one dispatched request) and
`agent_steps` (the orchestrator's classification hop plus the dispatched
specialist's action hop) -- the audit trail behind the "Agent trace" UI.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e91f4a76b0c3'
down_revision: Union[str, Sequence[str], None] = 'c7e2b9a15f34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agent_sessions',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='CASCADE'), nullable=True),
        sa.Column('goal', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='completed'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('completed', 'failed')", name='agent_sessions_status_check'),
    )
    op.create_index('agent_sessions_user_id_index', 'agent_sessions', ['user_id'])

    op.create_table(
        'agent_steps',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('session_id', sa.BigInteger(), sa.ForeignKey('agent_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('agent_type', sa.String(length=30), nullable=False),
        sa.Column('tool_used', sa.String(length=100), nullable=True),
        sa.Column('input', sa.Text(), nullable=False),
        sa.Column('output', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "agent_type IN ('orchestrator', 'tutor', 'planner', 'quiz_generator', 'exam_generator', 'flashcard_generator', 'researcher')",
            name='agent_steps_agent_type_check',
        ),
    )
    op.create_index('agent_steps_session_id_index', 'agent_steps', ['session_id'])


def downgrade() -> None:
    op.drop_index('agent_steps_session_id_index', table_name='agent_steps')
    op.drop_table('agent_steps')
    op.drop_index('agent_sessions_user_id_index', table_name='agent_sessions')
    op.drop_table('agent_sessions')
