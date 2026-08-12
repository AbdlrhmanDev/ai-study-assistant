"""add embedding_model to document_chunks

Revision ID: 32b0490a24ed
Revises: c91d7e4a2f60
Create Date: 2026-08-11 21:10:28.075634

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32b0490a24ed'
down_revision: Union[str, Sequence[str], None] = 'c91d7e4a2f60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "document_chunks",
        sa.Column("embedding_model", sa.String(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("document_chunks", "embedding_model")
