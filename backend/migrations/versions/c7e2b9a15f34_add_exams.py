"""add_exams

Revision ID: c7e2b9a15f34
Revises: a4f8c1e6d92a
Create Date: 2026-07-28 16:00:00.000000

Adds AI Exam Generator: `exams` / `exam_questions` (with rubric jsonb +
blooms_level) / `exam_attempts` (server-enforced deadline_at) /
`exam_answers` (criteria_scores jsonb for LLM rubric grading).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c7e2b9a15f34'
down_revision: Union[str, Sequence[str], None] = 'a4f8c1e6d92a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'exams',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('topic_id', sa.BigInteger(), sa.ForeignKey('topics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('time_limit_seconds', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("char_length(trim(title)) > 0", name='exams_title_not_empty'),
        sa.CheckConstraint('time_limit_seconds > 0', name='exams_time_limit_positive'),
    )
    op.create_index('exams_topic_id_index', 'exams', ['topic_id'])

    op.create_table(
        'exam_questions',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('exam_id', sa.BigInteger(), sa.ForeignKey('exams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('question_type', sa.String(length=20), nullable=False),
        sa.Column('blooms_level', sa.String(length=20), nullable=False),
        sa.Column('concept', sa.String(length=200), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=False),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('correct_answer', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('rubric', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=False),
        sa.Column('source_note_id', sa.BigInteger(), sa.ForeignKey('notes.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_document_id', sa.BigInteger(), sa.ForeignKey('documents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("char_length(trim(prompt)) > 0", name='exam_questions_prompt_not_empty'),
        sa.CheckConstraint(
            "question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay', 'case_study', 'coding')",
            name='exam_questions_type_check',
        ),
        sa.CheckConstraint(
            "blooms_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')",
            name='exam_questions_blooms_check',
        ),
    )
    op.create_index('exam_questions_exam_id_index', 'exam_questions', ['exam_id'])

    op.create_table(
        'exam_attempts',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('exam_id', sa.BigInteger(), sa.ForeignKey('exams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='in_progress'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deadline_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('score_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.CheckConstraint("status IN ('in_progress', 'completed')", name='exam_attempts_status_check'),
    )
    op.create_index('exam_attempts_exam_id_index', 'exam_attempts', ['exam_id'])
    op.create_index('exam_attempts_user_id_index', 'exam_attempts', ['user_id'])

    op.create_table(
        'exam_answers',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column('attempt_id', sa.BigInteger(), sa.ForeignKey('exam_attempts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_id', sa.BigInteger(), sa.ForeignKey('exam_questions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_answer', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('criteria_scores', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('points_earned', sa.Float(), nullable=True),
        sa.Column('points_possible', sa.Float(), nullable=False, server_default='1'),
        sa.Column('answered_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('attempt_id', 'question_id', name='uq_exam_answers_attempt_id_question_id'),
    )
    op.create_index('exam_answers_attempt_id_index', 'exam_answers', ['attempt_id'])


def downgrade() -> None:
    op.drop_index('exam_answers_attempt_id_index', table_name='exam_answers')
    op.drop_table('exam_answers')
    op.drop_index('exam_attempts_user_id_index', table_name='exam_attempts')
    op.drop_index('exam_attempts_exam_id_index', table_name='exam_attempts')
    op.drop_table('exam_attempts')
    op.drop_index('exam_questions_exam_id_index', table_name='exam_questions')
    op.drop_table('exam_questions')
    op.drop_index('exams_topic_id_index', table_name='exams')
    op.drop_table('exams')
