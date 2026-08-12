"""add file_size_bytes to documents

Revision ID: 5266d4dff9cf
Revises: 32b0490a24ed
Create Date: 2026-08-11 21:23:28.968066

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5266d4dff9cf'
down_revision: Union[str, Sequence[str], None] = '32b0490a24ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "documents",
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("documents", "file_size_bytes")
