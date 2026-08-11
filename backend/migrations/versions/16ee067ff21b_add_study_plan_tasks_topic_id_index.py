"""add_study_plan_tasks_topic_id_index

Revision ID: 16ee067ff21b
Revises: f2a7c910b3d4
Create Date: 2026-08-02 00:00:00.000000

study_plan_tasks.topic_id has an ON DELETE CASCADE foreign key to topics but
no index, so deleting a topic forces a sequential scan of study_plan_tasks
to find the rows to cascade to.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '16ee067ff21b'
down_revision: Union[str, Sequence[str], None] = 'f2a7c910b3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "study_plan_tasks_topic_id_index", "study_plan_tasks", ["topic_id"]
    )


def downgrade() -> None:
    op.drop_index("study_plan_tasks_topic_id_index", table_name="study_plan_tasks")
