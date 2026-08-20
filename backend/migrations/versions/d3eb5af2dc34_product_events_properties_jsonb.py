"""convert product_events.properties to jsonb

Revision ID: d3eb5af2dc34
Revises: c3f4e5d6a7b8
"""
from alembic import op
import sqlalchemy as sa

revision = "d3eb5af2dc34"
down_revision = "c3f4e5d6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "product_events",
        "properties",
        type_=sa.dialects.postgresql.JSONB(),
        existing_type=sa.JSON(),
        nullable=False,
        server_default=sa.text("'{}'::jsonb"),
        postgresql_using="properties::jsonb",
    )


def downgrade() -> None:
    op.alter_column(
        "product_events",
        "properties",
        type_=sa.JSON(),
        existing_type=sa.dialects.postgresql.JSONB(),
        nullable=False,
        server_default=sa.text("'{}'::json"),
        postgresql_using="properties::json",
    )
