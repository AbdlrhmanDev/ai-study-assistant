"""update document chunks exactly one source constraint

Revision ID: 4a6c85ad20a3
Revises: e46f9a7b3343
Create Date: 2026-08-11 22:09:27.197611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a6c85ad20a3'
down_revision: Union[str, Sequence[str], None] = 'e46f9a7b3343'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("document_chunks_exactly_one_source", "document_chunks", type_="check")
    op.create_check_constraint(
        "document_chunks_exactly_one_source",
        "document_chunks",
        "(note_id IS NOT NULL)::int + (document_id IS NOT NULL)::int + "
        "(workspace_page_id IS NOT NULL)::int = 1",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("document_chunks_exactly_one_source", "document_chunks", type_="check")
    op.create_check_constraint(
        "document_chunks_exactly_one_source",
        "document_chunks",
        "(note_id IS NOT NULL AND document_id IS NULL) OR "
        "(note_id IS NULL AND document_id IS NOT NULL)",
    )
