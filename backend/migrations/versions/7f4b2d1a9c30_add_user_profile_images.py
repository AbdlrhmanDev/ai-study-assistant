"""add user profile image metadata

Revision ID: 7f4b2d1a9c30
Revises: 4acdcf642c53
"""
from alembic import op
import sqlalchemy as sa

revision = "7f4b2d1a9c30"
down_revision = "4acdcf642c53"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_image_path", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("profile_image_content_type", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_image_content_type")
    op.drop_column("users", "profile_image_path")
