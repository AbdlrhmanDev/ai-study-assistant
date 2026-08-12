"""add status to exams

Revision ID: c3f4e5d6a7b8
Revises: b2f0a1d7c3e4
Create Date: 2026-08-12 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f4e5d6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2f0a1d7c3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exams",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="published"),
    )
    op.create_check_constraint(
        "exams_status_check",
        "exams",
        "status IN ('draft', 'published')",
    )


def downgrade() -> None:
    op.drop_constraint("exams_status_check", "exams", type_="check")
    op.drop_column("exams", "status")
