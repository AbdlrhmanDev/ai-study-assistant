from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .model import EmailVerificationToken, PasswordResetToken, UserSession


async def get_active(db: AsyncSession, token_hash: str, now: datetime) -> UserSession | None:
    row = await db.get(UserSession, token_hash)
    if row is not None and row.expires_at > now:
        return row
    return None


async def delete_by_hash(db: AsyncSession, token_hash: str) -> None:
    await db.execute(delete(UserSession).where(UserSession.id == token_hash))


async def upsert(
    db: AsyncSession,
    *,
    token_hash: str,
    user_id: int | None,
    data: dict,
    expires_at: datetime,
    user_agent: str | None = None,
    ip_address: str | None = None,
    last_seen_at: datetime | None = None,
) -> None:
    stmt = (
        pg_insert(UserSession)
        .values(
            id=token_hash, user_id=user_id, data=data, expires_at=expires_at,
            user_agent=user_agent, ip_address=ip_address, last_seen_at=last_seen_at,
        )
        .on_conflict_do_update(
            index_elements=[UserSession.id],
            set_={
                "data": data, "expires_at": expires_at, "user_id": user_id,
                "user_agent": user_agent, "ip_address": ip_address, "last_seen_at": last_seen_at,
            },
        )
    )
    await db.execute(stmt)


async def list_active_by_user(db: AsyncSession, user_id: int, now: datetime) -> list[UserSession]:
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id, UserSession.expires_at > now)
        .order_by(UserSession.last_seen_at.desc().nulls_last(), UserSession.created_at.desc())
    )
    return list(result.scalars().all())


async def get_owned(db: AsyncSession, token_hash: str, user_id: int) -> UserSession | None:
    row = await db.get(UserSession, token_hash)
    return row if row is not None and row.user_id == user_id else None


async def delete_all_by_user_except(db: AsyncSession, user_id: int, keep_token_hash: str | None) -> int:
    stmt = delete(UserSession).where(UserSession.user_id == user_id)
    if keep_token_hash is not None:
        stmt = stmt.where(UserSession.id != keep_token_hash)
    result = await db.execute(stmt)
    return result.rowcount or 0


async def delete_all_by_user(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(delete(UserSession).where(UserSession.user_id == user_id))
    return result.rowcount or 0


# --------------------------------------------------------------------------
# Email verification tokens
# --------------------------------------------------------------------------


async def create_email_verification_token(
    db: AsyncSession, *, token_hash: str, user_id: int, expires_at: datetime
) -> None:
    # A fresh request supersedes any previously issued (unclicked) link --
    # only the newest one should ever be valid.
    await db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id))
    db.add(EmailVerificationToken(id=token_hash, user_id=user_id, expires_at=expires_at))


async def get_valid_email_verification_token(
    db: AsyncSession, token_hash: str, now: datetime
) -> EmailVerificationToken | None:
    row = await db.get(EmailVerificationToken, token_hash)
    return row if row is not None and row.expires_at > now else None


async def delete_email_verification_tokens_for_user(db: AsyncSession, user_id: int) -> None:
    await db.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id))


# --------------------------------------------------------------------------
# Password reset tokens
# --------------------------------------------------------------------------


async def create_password_reset_token(
    db: AsyncSession, *, token_hash: str, user_id: int, expires_at: datetime
) -> None:
    # Same reasoning as email verification: a new request invalidates any
    # reset link sent earlier that hasn't been used yet.
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
    db.add(PasswordResetToken(id=token_hash, user_id=user_id, expires_at=expires_at))


async def get_valid_password_reset_token(
    db: AsyncSession, token_hash: str, now: datetime
) -> PasswordResetToken | None:
    row = await db.get(PasswordResetToken, token_hash)
    if row is None or row.used_at is not None or row.expires_at <= now:
        return None
    return row


async def mark_password_reset_token_used(db: AsyncSession, token_hash: str) -> None:
    await db.execute(
        update(PasswordResetToken).where(PasswordResetToken.id == token_hash).values(used_at=func.now())
    )
