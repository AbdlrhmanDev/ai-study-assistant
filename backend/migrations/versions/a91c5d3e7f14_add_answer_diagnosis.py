"""add_answer_diagnosis

Revision ID: a91c5d3e7f14
Revises: e58b3c9a1d02
Create Date: 2026-07-28 12:00:00.000000

Adds Explain Wrong Answers: `mistake_type` + `diagnosis` on `quiz_answers`,
computed once (cached) the first time a student views a wrong answer's
diagnosis.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a91c5d3e7f14'
down_revision: Union[str, Sequence[str], None] = 'e58b3c9a1d02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('quiz_answers', sa.Column('mistake_type', sa.String(length=20), nullable=True))
    op.add_column('quiz_answers', sa.Column('diagnosis', sa.Text(), nullable=True))
    op.create_check_constraint(
        'quiz_answers_mistake_type_check',
        'quiz_answers',
        "mistake_type IS NULL OR mistake_type IN ('slip', 'partial', 'misconception', 'guess')",
    )


def downgrade() -> None:
    op.drop_constraint('quiz_answers_mistake_type_check', 'quiz_answers', type_='check')
    op.drop_column('quiz_answers', 'diagnosis')
    op.drop_column('quiz_answers', 'mistake_type')
