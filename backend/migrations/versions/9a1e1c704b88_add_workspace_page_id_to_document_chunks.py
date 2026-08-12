"""add workspace page id to document chunks

Revision ID: 9a1e1c704b88
Revises: f41581a1ee93
Create Date: 2026-08-11 22:02:08.112131

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a1e1c704b88'
down_revision: Union[str, Sequence[str], None] = 'f41581a1ee93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "document_chunks",
        sa.Column("workspace_page_id", sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        "document_chunks_workspace_page_id_fkey",
        "document_chunks", "workspace_pages",
        ["workspace_page_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index(
        "document_chunks_workspace_page_id_index", "document_chunks", ["workspace_page_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("document_chunks_workspace_page_id_index", table_name="document_chunks")
    op.drop_constraint("document_chunks_workspace_page_id_fkey", "document_chunks", type_="foreignkey")
    op.drop_column("document_chunks", "workspace_page_id")
