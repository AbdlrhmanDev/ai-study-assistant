"""add message feedback

Revision ID: 9d8ce3402c28
Revises: 4a6c85ad20a3
Create Date: 2026-08-12 00:31:59.519618

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d8ce3402c28'
down_revision: Union[str, Sequence[str], None] = '4a6c85ad20a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "message_feedback",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "message_id", sa.BigInteger(),
            sa.ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False, unique=True,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.func.now(), onupdate=sa.func.now(),
        ),
        sa.CheckConstraint("rating IN (-1, 1)", name="message_feedback_rating_check"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("message_feedback")
