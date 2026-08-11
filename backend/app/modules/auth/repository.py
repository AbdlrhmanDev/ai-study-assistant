from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .model import UserSession


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
