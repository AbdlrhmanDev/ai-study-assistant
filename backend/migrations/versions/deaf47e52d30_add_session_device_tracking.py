"""add user_agent/ip_address/last_seen_at to user_sessions for device listing

Revision ID: deaf47e52d30
Revises: 589f7b1511f8
"""
from alembic import op
import sqlalchemy as sa

revision = "deaf47e52d30"
down_revision = "589f7b1511f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_sessions", sa.Column("user_agent", sa.String(300), nullable=True))
    op.add_column("user_sessions", sa.Column("ip_address", sa.String(64), nullable=True))
    op.add_column(
        "user_sessions", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("user_sessions", "last_seen_at")
    op.drop_column("user_sessions", "ip_address")
    op.drop_column("user_sessions", "user_agent")
