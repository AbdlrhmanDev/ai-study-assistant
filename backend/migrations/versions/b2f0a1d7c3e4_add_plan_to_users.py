"""add plan to users

Revision ID: b2f0a1d7c3e4
Revises: 9d8ce3402c28
Create Date: 2026-08-12 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2f0a1d7c3e4"
down_revision: Union[str, Sequence[str], None] = "9d8ce3402c28"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("plan", sa.String(length=20), nullable=False, server_default="beta"),
    )
    op.create_check_constraint(
        "users_plan_valid",
        "users",
        "char_length(trim(plan)) > 0 AND plan = lower(plan)",
    )


def downgrade() -> None:
    op.drop_constraint("users_plan_valid", "users", type_="check")
    op.drop_column("users", "plan")
