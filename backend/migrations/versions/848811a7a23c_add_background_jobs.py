"""add durable background_jobs table

Revision ID: 848811a7a23c
Revises: 8c1f24d7a9b0
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "848811a7a23c"
down_revision = "8c1f24d7a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "background_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("idempotency_key", sa.String(200), nullable=True),
        sa.Column("correlation_id", sa.String(64), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.func.now(), onupdate=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('queued','running','completed','failed','dead')",
            name="background_jobs_status_check",
        ),
    )
    op.create_index("background_jobs_status_index", "background_jobs", ["status"])
    op.create_index(
        "background_jobs_status_created_at_index", "background_jobs", ["status", "created_at"]
    )
    op.create_index(
        "background_jobs_idempotency_key_index", "background_jobs", ["idempotency_key"]
    )


def downgrade() -> None:
    op.drop_table("background_jobs")
