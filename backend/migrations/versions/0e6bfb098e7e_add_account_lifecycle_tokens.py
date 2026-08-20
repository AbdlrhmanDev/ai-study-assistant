"""add email verification / password reset tokens

Revision ID: 0e6bfb098e7e
Revises: d3eb5af2dc34
"""
from alembic import op
import sqlalchemy as sa

revision = "0e6bfb098e7e"
down_revision = "d3eb5af2dc34"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "email_verification_tokens_user_id_index", "email_verification_tokens", ["user_id"]
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "password_reset_tokens_user_id_index", "password_reset_tokens", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("password_reset_tokens_user_id_index", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_index("email_verification_tokens_user_id_index", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_column("users", "email_verified_at")
