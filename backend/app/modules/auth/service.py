from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from ...core.exceptions import AppError
from ...core.security import destroy_session, regenerate_session, verify_password
from ..users import repository as users_repository
from ..users import service as users_service
from ..users.model import User


def _to_session_user(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email}


async def register(
    db: AsyncSession, request: Request, *, name: str, email: str, password: str
) -> dict:
    user = await users_service.register(db, name=name, email=email, password=password)
    session_user = _to_session_user(user)
    regenerate_session(request)
    request.session["user"] = session_user
    return session_user


async def login(db: AsyncSession, request: Request, *, email: str, password: str) -> dict:
    user = await users_repository.get_by_email_ci(db, email)
    valid = user is not None and await verify_password(password, user.password_hash)
    if not valid:
        raise AppError("Invalid email or password", 401)

    session_user = _to_session_user(user)
    regenerate_session(request)
    request.session["user"] = session_user
    return session_user


def logout(request: Request) -> None:
    destroy_session(request)


async def update_profile(
    db: AsyncSession,
    request: Request,
    user_id: int,
    *,
    name: str | None,
    email: str | None,
) -> dict:
    user = await users_service.update_profile(db, user_id, name=name, email=email)
    session_user = _to_session_user(user)
    request.session["user"] = session_user
    return session_user
