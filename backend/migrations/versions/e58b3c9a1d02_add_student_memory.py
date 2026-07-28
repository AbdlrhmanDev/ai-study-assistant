"""add_student_memory

Revision ID: e58b3c9a1d02
Revises: d47a1e6f2b90
Create Date: 2026-07-28 11:00:00.000000

Adds AI Memory: `student_memory`, a durable, editable fact/preference the
AI has learned about a student, consulted by the AI Tutor's prompt builder.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e58b3c9a1d02'
down_revision: Union[str, Sequence[str], None] = 'd47a1e6f2b90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'student_memory',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('memory_type', sa.String(length=20), nullable=False),
        sa.Column('key', sa.String(length=200), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), server_default='0.5', nullable=False),
        sa.Column('reinforcement_count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('last_reinforced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "memory_type IN ('strength', 'weakness', 'preference', 'fact')",
            name=op.f('student_memory_type_check'),
        ),
        sa.CheckConstraint("char_length(trim(value)) > 0", name=op.f('student_memory_value_not_empty')),
        sa.CheckConstraint(
            "confidence >= 0 AND confidence <= 1", name=op.f('student_memory_confidence_range_check')
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_student_memory_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_student_memory')),
        sa.UniqueConstraint('user_id', 'key', name=op.f('uq_student_memory_user_id_key')),
    )
    op.create_index('student_memory_user_id_index', 'student_memory', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('student_memory_user_id_index', table_name='student_memory')
    op.drop_table('student_memory')
