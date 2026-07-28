from datetime import datetime

from sqlalchemy import delete
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
) -> None:
    stmt = (
        pg_insert(UserSession)
        .values(id=token_hash, user_id=user_id, data=data, expires_at=expires_at)
        .on_conflict_do_update(
            index_elements=[UserSession.id],
            set_={"data": data, "expires_at": expires_at, "user_id": user_id},
        )
    )
    await db.execute(stmt)
