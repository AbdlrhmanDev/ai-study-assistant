"""add_quizzes

Revision ID: c58e2a917d3b
Revises: b41f7c92e3a1
Create Date: 2026-07-27 20:10:00.000000

Adds the Interactive Quiz & Assessment System: `quizzes` (a generated,
immutable set of questions), `quiz_questions` (options/correct_answer as
JSONB -- shape varies per question_type, see app/modules/quizzes/grading.py),
`quiz_attempts` (one row per take, so performance can be compared over
time), and `quiz_answers` (per-question graded responses within an
attempt). Also widens `study_activities_type_check` for the two new
activity types this feature logs.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c58e2a917d3b'
down_revision: Union[str, Sequence[str], None] = 'b41f7c92e3a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'quizzes',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('source_type', sa.String(length=20), nullable=False),
        sa.Column('note_id', sa.BigInteger(), nullable=True),
        sa.Column('document_id', sa.BigInteger(), nullable=True),
        sa.Column('concept', sa.Text(), nullable=True),
        sa.Column('difficulty', sa.String(length=10), server_default='medium', nullable=False),
        sa.Column('timed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('time_limit_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("char_length(trim(title)) > 0", name=op.f('quizzes_title_not_empty')),
        sa.CheckConstraint(
            "source_type IN ('topic', 'note', 'document', 'concept', 'weak_areas')",
            name=op.f('quizzes_source_type_check'),
        ),
        sa.CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard', 'mixed')",
            name=op.f('quizzes_difficulty_check'),
        ),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.id'], name=op.f('fk_quizzes_topic_id_topics'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['note_id'], ['notes.id'], name=op.f('fk_quizzes_note_id_notes'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name=op.f('fk_quizzes_document_id_documents'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_quizzes')),
    )
    op.create_index('quizzes_topic_id_index', 'quizzes', ['topic_id'], unique=False)

    op.create_table(
        'quiz_questions',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('quiz_id', sa.BigInteger(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('question_type', sa.String(length=20), nullable=False),
        sa.Column('concept', sa.String(length=200), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=False),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('correct_answer', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=False),
        sa.Column('source_note_id', sa.BigInteger(), nullable=True),
        sa.Column('source_document_id', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("char_length(trim(prompt)) > 0", name=op.f('quiz_questions_prompt_not_empty')),
        sa.CheckConstraint(
            "question_type IN ('multiple_choice', 'true_false', 'short_answer', 'fill_blank', 'matching', 'scenario')",
            name=op.f('quiz_questions_type_check'),
        ),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], name=op.f('fk_quiz_questions_quiz_id_quizzes'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_note_id'], ['notes.id'], name=op.f('fk_quiz_questions_source_note_id_notes'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['source_document_id'], ['documents.id'], name=op.f('fk_quiz_questions_source_document_id_documents'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_questions')),
    )
    op.create_index('quiz_questions_quiz_id_index', 'quiz_questions', ['quiz_id'], unique=False)

    op.create_table(
        'quiz_attempts',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('quiz_id', sa.BigInteger(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='in_progress', nullable=False),
        sa.Column('immediate_feedback', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('correct_count', sa.Integer(), nullable=True),
        sa.Column('total_count', sa.Integer(), nullable=True),
        sa.CheckConstraint("status IN ('in_progress', 'completed')", name=op.f('quiz_attempts_status_check')),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], name=op.f('fk_quiz_attempts_quiz_id_quizzes'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_quiz_attempts_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_attempts')),
    )
    op.create_index('quiz_attempts_quiz_id_index', 'quiz_attempts', ['quiz_id'], unique=False)
    op.create_index('quiz_attempts_user_id_index', 'quiz_attempts', ['user_id'], unique=False)

    op.create_table(
        'quiz_answers',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('attempt_id', sa.BigInteger(), nullable=False),
        sa.Column('question_id', sa.BigInteger(), nullable=False),
        sa.Column('student_answer', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('answered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['attempt_id'], ['quiz_attempts.id'], name=op.f('fk_quiz_answers_attempt_id_quiz_attempts'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['quiz_questions.id'], name=op.f('fk_quiz_answers_question_id_quiz_questions'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_answers')),
        sa.UniqueConstraint('attempt_id', 'question_id', name=op.f('uq_quiz_answers_attempt_id_question_id')),
    )
    op.create_index('quiz_answers_attempt_id_index', 'quiz_answers', ['attempt_id'], unique=False)

    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check',
        'study_activities',
        "activity_type IN ('topic_created','topic_updated','note_created','note_updated',"
        "'note_moved','ai_chat','flashcard_created','flashcards_generated',"
        "'quiz_generated','quiz_completed')",
    )


def downgrade() -> None:
    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check',
        'study_activities',
        "activity_type IN ('topic_created','topic_updated','note_created','note_updated',"
        "'note_moved','ai_chat','flashcard_created','flashcards_generated')",
    )

    op.drop_index('quiz_answers_attempt_id_index', table_name='quiz_answers')
    op.drop_table('quiz_answers')

    op.drop_index('quiz_attempts_user_id_index', table_name='quiz_attempts')
    op.drop_index('quiz_attempts_quiz_id_index', table_name='quiz_attempts')
    op.drop_table('quiz_attempts')

    op.drop_index('quiz_questions_quiz_id_index', table_name='quiz_questions')
    op.drop_table('quiz_questions')

    op.drop_index('quizzes_topic_id_index', table_name='quizzes')
    op.drop_table('quizzes')
