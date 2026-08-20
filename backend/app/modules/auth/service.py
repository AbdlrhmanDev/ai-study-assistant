from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from ...core.config import get_settings
from ...core.exceptions import AppError
from ...core.mail import send_email
from ...core.security import (
    destroy_session,
    hash_opaque_token,
    hash_password,
    new_opaque_token,
    regenerate_session,
    verify_password,
)
from ..users import repository as users_repository
from ..users import service as users_service
from ..users.model import User
from . import repository as auth_repository

logger = structlog.get_logger("study_assistant")


def _to_session_user(user: User) -> dict:
    # Keep the session payload identical to the public auth response. This
    # prevents profile-aware clients from seeing a different user shape
    # immediately after register, login, or profile updates.
    return users_service.public_user(user)


async def register(
    db: AsyncSession, request: Request, *, name: str, email: str, password: str
) -> dict:
    user = await users_service.register(db, name=name, email=email, password=password)
    session_user = _to_session_user(user)
    regenerate_session(request)
    request.session["user"] = session_user

    # Best-effort: a signup must succeed even if SMTP isn't configured
    # (e.g. local dev) or the send fails -- the account isn't locked behind
    # verification, and the user can always request another link.
    try:
        await request_email_verification(db, user.id, user.email)
    except Exception:
        logger.warning("verification_email_send_failed", user_id=user.id, exc_info=True)

    return users_service.public_user(user)


async def login(db: AsyncSession, request: Request, *, email: str, password: str) -> dict:
    user = await users_repository.get_by_email_ci(db, email)
    valid = user is not None and await verify_password(password, user.password_hash)
    if not valid:
        raise AppError("Invalid email or password", 401)

    session_user = _to_session_user(user)
    regenerate_session(request)
    request.session["user"] = session_user
    return users_service.public_user(user)


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
    return users_service.public_user(user)


async def get_profile(db: AsyncSession, user_id: int) -> dict:
    user = await users_repository.get_by_id(db, user_id)
    if user is None:
        return {}
    return users_service.public_user(user)


# --------------------------------------------------------------------------
# Email verification
# --------------------------------------------------------------------------


async def request_email_verification(db: AsyncSession, user_id: int, email: str) -> None:
    settings = get_settings()
    raw_token = new_opaque_token()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.email_verification_token_ttl_minutes
    )
    await auth_repository.create_email_verification_token(
        db, token_hash=hash_opaque_token(raw_token), user_id=user_id, expires_at=expires_at
    )
    await db.commit()

    link = f"{settings.app_public_url.rstrip('/')}/verify-email/{raw_token}"
    try:
        await send_email(
            email,
            "Verify your Studia email address",
            f"Confirm this is your email address to finish setting up your account.\n\n"
            f"Verify: {link}\n\nThis link expires in {settings.email_verification_token_ttl_minutes} minutes.",
        )
    except Exception as error:
        # The token is already committed either way -- a caller doing an
        # explicit resend deserves to know delivery failed (unlike password
        # reset below, there's no account-enumeration concern here: the
        # caller already knows their own email).
        logger.warning("verification_email_send_failed", user_id=user_id, exc_info=True)
        raise AppError("Could not send the verification email right now, try again shortly", 503) from error


async def verify_email(db: AsyncSession, raw_token: str) -> dict:
    token_hash = hash_opaque_token(raw_token)
    row = await auth_repository.get_valid_email_verification_token(
        db, token_hash, datetime.now(timezone.utc)
    )
    if row is None:
        raise AppError("This verification link is invalid or has expired", 400)

    user = await users_repository.get_by_id(db, row.user_id)
    if user is None:
        raise AppError("This verification link is invalid or has expired", 400)

    await users_repository.set_email_verified(db, user.id, datetime.now(timezone.utc))
    await auth_repository.delete_email_verification_tokens_for_user(db, user.id)
    await db.commit()
    logger.info("email_verified", user_id=user.id)
    return {"verified": True}


# --------------------------------------------------------------------------
# Forgot / reset password
# --------------------------------------------------------------------------


async def request_password_reset(db: AsyncSession, email: str) -> None:
    """Always looks like it succeeded regardless of whether the email
    exists, so a caller can't use this endpoint to enumerate registered
    accounts."""
    user = await users_repository.get_by_email_ci(db, email)
    if user is None:
        return

    settings = get_settings()
    raw_token = new_opaque_token()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.password_reset_token_ttl_minutes
    )
    await auth_repository.create_password_reset_token(
        db, token_hash=hash_opaque_token(raw_token), user_id=user.id, expires_at=expires_at
    )
    await db.commit()

    link = f"{settings.app_public_url.rstrip('/')}/reset-password/{raw_token}"
    try:
        await send_email(
            user.email,
            "Reset your Studia password",
            f"We received a request to reset your Studia password.\n\n"
            f"Reset it: {link}\n\nThis link expires in {settings.password_reset_token_ttl_minutes} minutes. "
            f"If you didn't request this, you can ignore this email.",
        )
    except Exception:
        # Never let a send failure surface here -- a different response for
        # "email exists but delivery failed" vs "email doesn't exist" would
        # itself be an account-enumeration signal, defeating the whole
        # point of this endpoint always looking like it succeeded.
        logger.warning("password_reset_email_send_failed", user_id=user.id, exc_info=True)


async def reset_password(db: AsyncSession, raw_token: str, new_password: str) -> dict:
    token_hash = hash_opaque_token(raw_token)
    row = await auth_repository.get_valid_password_reset_token(
        db, token_hash, datetime.now(timezone.utc)
    )
    if row is None:
        raise AppError("This reset link is invalid or has expired", 400)

    new_hash = await hash_password(new_password)
    await users_repository.set_password_hash(db, row.user_id, new_hash)
    await auth_repository.mark_password_reset_token_used(db, token_hash)
    # No current session to preserve here (the caller isn't authenticated) --
    # a password reset revokes every existing session, same as a normal
    # password change revokes every session but the one making the change.
    revoked = await auth_repository.delete_all_by_user(db, row.user_id)
    await db.commit()
    logger.info("password_reset", user_id=row.user_id, sessions_revoked=revoked)
    return {"reset": True}
