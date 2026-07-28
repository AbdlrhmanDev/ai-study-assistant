"""add_adaptive_quiz

Revision ID: b6f83a2e9c17
Revises: a91c5d3e7f14
Create Date: 2026-07-28 13:00:00.000000

Adds the Adaptive Quiz Engine: `quizzes.adaptive`, a continuous
`quiz_questions.difficulty_score` (alongside the existing coarse
easy/medium/hard/mixed label), and `quiz_attempts.ability_estimate` /
`ability_trace` for the live ability estimate and its history.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b6f83a2e9c17'
down_revision: Union[str, Sequence[str], None] = 'a91c5d3e7f14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('quizzes', sa.Column('adaptive', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('quiz_questions', sa.Column('difficulty_score', sa.Float(), server_default='0.5', nullable=False))
    op.add_column('quiz_attempts', sa.Column('ability_estimate', sa.Float(), nullable=True))
    op.add_column('quiz_attempts', sa.Column('ability_trace', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('quiz_attempts', 'ability_trace')
    op.drop_column('quiz_attempts', 'ability_estimate')
    op.drop_column('quiz_questions', 'difficulty_score')
    op.drop_column('quizzes', 'adaptive')
