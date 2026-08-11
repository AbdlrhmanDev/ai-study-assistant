"""add durable AI usage events

Revision ID: 8c1f24d7a9b0
Revises: 16ee067ff21b
"""
from alembic import op
import sqlalchemy as sa

revision = "8c1f24d7a9b0"
down_revision = "16ee067ff21b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usage_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("feature", sa.String(50), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("image_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fallbacks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("prompt_version", sa.String(30), nullable=False, server_default="v1"),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("usage_events_user_created_index", "usage_events", ["user_id", "created_at"])
    op.create_index("usage_events_feature_created_index", "usage_events", ["feature", "created_at"])


def downgrade() -> None:
    op.drop_table("usage_events")
