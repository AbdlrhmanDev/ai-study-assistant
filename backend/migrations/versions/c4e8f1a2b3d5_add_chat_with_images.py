"""add_chat_with_images

Revision ID: c4e8f1a2b3d5
Revises: b7d3e5a9c142
Create Date: 2026-07-28 21:00:00.000000

Widens `chat_messages`' allowed modes to add 'image', for the AI tutor's
new multimodal chat turns (a photo of a diagram/problem plus a question).
No new tables -- the uploaded image itself is never persisted, only the
resulting text exchange.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c4e8f1a2b3d5'
down_revision: Union[str, Sequence[str], None] = 'b7d3e5a9c142'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('chat_messages_mode_check', 'chat_messages', type_='check')
    op.create_check_constraint(
        'chat_messages_mode_check', 'chat_messages', "mode IN ('tutor', 'sparring', 'image')",
    )


def downgrade() -> None:
    op.drop_constraint('chat_messages_mode_check', 'chat_messages', type_='check')
    op.create_check_constraint(
        'chat_messages_mode_check', 'chat_messages', "mode IN ('tutor', 'sparring')",
    )
