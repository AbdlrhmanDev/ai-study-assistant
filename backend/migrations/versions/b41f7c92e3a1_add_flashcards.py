"""add_flashcards

Revision ID: b41f7c92e3a1
Revises: a30c5cd8f9a6
Create Date: 2026-07-27 18:40:00.000000

Adds the Smart Flashcards feature: `flashcards` (SM-2 spaced-repetition
state lives directly on the row) and `flashcard_reviews` (append-only
history, used for retention-rate stats). Also widens the
`study_activities_type_check` constraint for the two new activity types
this feature logs.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b41f7c92e3a1'
down_revision: Union[str, Sequence[str], None] = 'a30c5cd8f9a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'flashcards',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('topic_id', sa.BigInteger(), nullable=False),
        sa.Column('note_id', sa.BigInteger(), nullable=True),
        sa.Column('document_id', sa.BigInteger(), nullable=True),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('origin', sa.String(length=10), server_default='manual', nullable=False),
        sa.Column('status', sa.String(length=10), server_default='active', nullable=False),
        sa.Column('repetitions', sa.Integer(), server_default='0', nullable=False),
        sa.Column('ease_factor', sa.Float(), server_default='2.5', nullable=False),
        sa.Column('interval_days', sa.Integer(), server_default='0', nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_rating', sa.String(length=10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "char_length(trim(question)) > 0", name=op.f('flashcards_question_not_empty')
        ),
        sa.CheckConstraint(
            "char_length(trim(answer)) > 0", name=op.f('flashcards_answer_not_empty')
        ),
        sa.CheckConstraint("origin IN ('manual','ai')", name=op.f('flashcards_origin_check')),
        sa.CheckConstraint("status IN ('active','archived')", name=op.f('flashcards_status_check')),
        sa.CheckConstraint(
            "last_rating IS NULL OR last_rating IN ('easy','medium','hard','forgot')",
            name=op.f('flashcards_last_rating_check'),
        ),
        sa.ForeignKeyConstraint(
            ['topic_id'], ['topics.id'], name=op.f('fk_flashcards_topic_id_topics'), ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['note_id'], ['notes.id'], name=op.f('fk_flashcards_note_id_notes'), ondelete='SET NULL'
        ),
        sa.ForeignKeyConstraint(
            ['document_id'], ['documents.id'], name=op.f('fk_flashcards_document_id_documents'),
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_flashcards')),
    )
    op.create_index('flashcards_topic_id_index', 'flashcards', ['topic_id'], unique=False)
    op.create_index('flashcards_note_id_index', 'flashcards', ['note_id'], unique=False)
    op.create_index('flashcards_document_id_index', 'flashcards', ['document_id'], unique=False)
    op.create_index('flashcards_topic_due_at_index', 'flashcards', ['topic_id', 'due_at'], unique=False)

    op.create_table(
        'flashcard_reviews',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('flashcard_id', sa.BigInteger(), nullable=False),
        sa.Column('rating', sa.String(length=10), nullable=False),
        sa.Column('quality', sa.Integer(), nullable=False),
        sa.Column('interval_days_after', sa.Integer(), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "rating IN ('easy','medium','hard','forgot')", name=op.f('flashcard_reviews_rating_check')
        ),
        sa.ForeignKeyConstraint(
            ['flashcard_id'], ['flashcards.id'], name=op.f('fk_flashcard_reviews_flashcard_id_flashcards'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_flashcard_reviews')),
    )
    op.create_index(
        'flashcard_reviews_flashcard_id_index', 'flashcard_reviews', ['flashcard_id'], unique=False
    )

    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check',
        'study_activities',
        "activity_type IN ('topic_created','topic_updated','note_created','note_updated',"
        "'note_moved','ai_chat','flashcard_created','flashcards_generated')",
    )


def downgrade() -> None:
    op.drop_constraint('study_activities_type_check', 'study_activities', type_='check')
    op.create_check_constraint(
        'study_activities_type_check',
        'study_activities',
        "activity_type IN ('topic_created','topic_updated','note_created','note_updated',"
        "'note_moved','ai_chat')",
    )

    op.drop_index('flashcard_reviews_flashcard_id_index', table_name='flashcard_reviews')
    op.drop_table('flashcard_reviews')

    op.drop_index('flashcards_topic_due_at_index', table_name='flashcards')
    op.drop_index('flashcards_document_id_index', table_name='flashcards')
    op.drop_index('flashcards_note_id_index', table_name='flashcards')
    op.drop_index('flashcards_topic_id_index', table_name='flashcards')
    op.drop_table('flashcards')
