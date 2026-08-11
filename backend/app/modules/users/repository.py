from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import User


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def get_by_email_ci(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(func.lower(User.email) == email.lower()))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, name: str, email: str, password_hash: str) -> User:
    user = User(name=name, email=email, password_hash=password_hash)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_profile(
    db: AsyncSession, user_id: int, *, name: str | None, email: str | None
) -> User | None:
    user = await db.get(User, user_id)
    if user is None:
        return None
    if name is not None:
        user.name = name
    if email is not None:
        user.email = email
    await db.flush()
    await db.refresh(user)
    return user


async def set_password_hash(db: AsyncSession, user_id: int, password_hash: str) -> None:
    user = await db.get(User, user_id)
    if user is not None:
        user.password_hash = password_hash


async def set_profile_image(
    db: AsyncSession, user_id: int, *, storage_path: str, content_type: str
) -> User | None:
    user = await db.get(User, user_id)
    if user is None:
        return None
    user.profile_image_path = storage_path
    user.profile_image_content_type = content_type
    await db.flush()
    await db.refresh(user)
    return user


async def delete(db: AsyncSession, user_id: int) -> bool:
    """Cascades to virtually every other table via ON DELETE CASCADE FKs
    from users.id/topics.id -- see the account-deletion service function
    for the handful of things that don't cascade (object storage, queued
    jobs) and must be cleaned up explicitly before this runs."""
    user = await db.get(User, user_id)
    if user is None:
        return False
    await db.delete(user)
    return True
