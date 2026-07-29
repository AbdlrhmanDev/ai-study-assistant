"""add_workspace_pages

Revision ID: a15f7c2d9e64
Revises: c4e8f1a2b3d5
Create Date: 2026-07-29 12:00:00.000000

Adds `workspace_pages`: a lightweight Notion-style page (an ordered JSONB
list of typed blocks -- heading/text/checklist/link) that lives outside the
topic hierarchy but can optionally link to one topic.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a15f7c2d9e64'
down_revision: Union[str, Sequence[str], None] = 'c4e8f1a2b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workspace_pages',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('blocks', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("char_length(trim(title)) > 0", name='workspace_pages_title_not_empty'),
    )
    op.create_index('workspace_pages_user_id_index', 'workspace_pages', ['user_id'])
    op.create_index('workspace_pages_topic_id_index', 'workspace_pages', ['topic_id'])


def downgrade() -> None:
    op.drop_index('workspace_pages_topic_id_index', table_name='workspace_pages')
    op.drop_index('workspace_pages_user_id_index', table_name='workspace_pages')
    op.drop_table('workspace_pages')
