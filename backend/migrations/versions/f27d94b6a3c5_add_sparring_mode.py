"""add_sparring_mode

Revision ID: f27d94b6a3c5
Revises: b6f83a2e9c17
Create Date: 2026-07-28 13:00:00.000000

Adds Socratic Sparring Mode: a `mode` column on `chat_messages`
(tutor | sparring) so the AI Tutor endpoint can carry a debate-style
conversation alongside its normal grounded-answer conversation.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f27d94b6a3c5'
down_revision: Union[str, Sequence[str], None] = 'b6f83a2e9c17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'chat_messages',
        sa.Column('mode', sa.String(length=20), nullable=False, server_default='tutor'),
    )
    op.create_check_constraint(
        'chat_messages_mode_check',
        'chat_messages',
        "mode IN ('tutor', 'sparring')",
    )


def downgrade() -> None:
    op.drop_constraint('chat_messages_mode_check', 'chat_messages', type_='check')
    op.drop_column('chat_messages', 'mode')
