"""add status to quizzes

Revision ID: f41581a1ee93
Revises: 5266d4dff9cf
Create Date: 2026-08-11 21:36:47.696788

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f41581a1ee93'
down_revision: Union[str, Sequence[str], None] = '5266d4dff9cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "quizzes",
        sa.Column("status", sa.String(length=10), nullable=False, server_default="published"),
    )
    op.create_check_constraint(
        "quizzes_status_check", "quizzes", "status IN ('draft', 'published')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("quizzes_status_check", "quizzes", type_="check")
    op.drop_column("quizzes", "status")
