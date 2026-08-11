"""add cleanup_runs audit trail for scheduled retention sweeps

Revision ID: 4acdcf642c53
Revises: deaf47e52d30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "4acdcf642c53"
down_revision = "deaf47e52d30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cleanup_runs",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("sweep_type", sa.String(50), nullable=False),
        sa.Column("counts", postgresql.JSONB(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("cleanup_runs")
