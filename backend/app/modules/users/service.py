from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.security import hash_password
from . import repository
from .exceptions import EmailAlreadyRegisteredError, UserNotFoundError
from .model import User


async def register(db: AsyncSession, *, name: str, email: str, password: str) -> User:
    if await repository.get_by_email_ci(db, email) is not None:
        raise EmailAlreadyRegisteredError()

    password_hash = await hash_password(password)
    try:
        user = await repository.create(db, name=name, email=email, password_hash=password_hash)
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise EmailAlreadyRegisteredError() from error
    return user


async def update_profile(
    db: AsyncSession, user_id: int, *, name: str | None, email: str | None
) -> User:
    if email is not None:
        existing = await repository.get_by_email_ci(db, email)
        if existing is not None and existing.id != user_id:
            raise EmailAlreadyRegisteredError()

    try:
        user = await repository.update_profile(db, user_id, name=name, email=email)
        if user is None:
            raise UserNotFoundError()
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise EmailAlreadyRegisteredError() from error
    return user
