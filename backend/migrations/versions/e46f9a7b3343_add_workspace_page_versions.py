"""add workspace page versions

Revision ID: e46f9a7b3343
Revises: 9a1e1c704b88
Create Date: 2026-08-11 22:02:23.676205

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e46f9a7b3343'
down_revision: Union[str, Sequence[str], None] = '9a1e1c704b88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "workspace_page_versions",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "workspace_page_id", sa.BigInteger(),
            sa.ForeignKey("workspace_pages.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("blocks", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "workspace_page_versions_page_id_index", "workspace_page_versions", ["workspace_page_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("workspace_page_versions_page_id_index", table_name="workspace_page_versions")
    op.drop_table("workspace_page_versions")
