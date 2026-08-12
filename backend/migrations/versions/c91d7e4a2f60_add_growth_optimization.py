"""add growth optimization tables

Revision ID: c91d7e4a2f60
Revises: 7f4b2d1a9c30
"""
from alembic import op
import sqlalchemy as sa

revision = "c91d7e4a2f60"
down_revision = "7f4b2d1a9c30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("product_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("properties", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("product_events_name_created_index", "product_events", ["name", "created_at"])
    op.create_index("product_events_user_created_index", "product_events", ["user_id", "created_at"])
    op.create_table("answer_feedback",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", sa.BigInteger(), sa.ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(40)), sa.Column("comment", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("rating IN (-1, 1)", name="answer_feedback_rating_check"),
        sa.UniqueConstraint("user_id", "message_id", name="answer_feedback_user_message_unique"),
    )
    op.create_index("answer_feedback_created_index", "answer_feedback", ["created_at"])
    op.create_table("reminder_preferences",
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("hour_local", sa.Integer(), nullable=False, server_default="18"),
        sa.Column("timezone", sa.String(80), nullable=False, server_default="UTC"),
        sa.Column("minimum_due_cards", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("hour_local BETWEEN 0 AND 23", name="reminder_preferences_hour_check"),
        sa.CheckConstraint("minimum_due_cards >= 1", name="reminder_preferences_minimum_due_check"),
    )
    op.create_table("reminder_deliveries",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False), sa.Column("due_cards", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('sent','failed','skipped')", name="reminder_deliveries_status_check"),
        sa.UniqueConstraint("user_id", "reminder_date", name="reminder_deliveries_user_date_unique"),
    )


def downgrade() -> None:
    op.drop_table("reminder_deliveries")
    op.drop_table("reminder_preferences")
    op.drop_index("answer_feedback_created_index", table_name="answer_feedback")
    op.drop_table("answer_feedback")
    op.drop_index("product_events_user_created_index", table_name="product_events")
    op.drop_index("product_events_name_created_index", table_name="product_events")
    op.drop_table("product_events")
