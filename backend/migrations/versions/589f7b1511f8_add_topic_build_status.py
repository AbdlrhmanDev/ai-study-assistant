"""add topic_build_status for async knowledge-graph/mind-map rebuilds

Revision ID: 589f7b1511f8
Revises: 848811a7a23c
"""
from alembic import op
import sqlalchemy as sa

revision = "589f7b1511f8"
down_revision = "848811a7a23c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "topic_build_status",
        sa.Column("topic_id", sa.BigInteger(), sa.ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("build_type", sa.String(30), primary_key=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.func.now(), onupdate=sa.func.now(),
        ),
        sa.CheckConstraint("build_type IN ('knowledge_graph','mind_map')", name="topic_build_status_type_check"),
        sa.CheckConstraint(
            "status IN ('pending','processing','completed','failed')",
            name="topic_build_status_status_check",
        ),
    )


def downgrade() -> None:
    op.drop_table("topic_build_status")
