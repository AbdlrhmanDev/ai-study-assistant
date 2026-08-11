"""Single enforcement point for admin-only endpoints, backed by the
`ADMIN_EMAILS` allowlist (no `is_admin` column exists -- admin status is
env-config-only, same as it was before this was centralized). Returns 404
rather than 403 so an admin surface's existence isn't revealed to a probing
non-admin user."""

from typing import Annotated

from fastapi import Depends

from .config import get_settings
from .exceptions import AppError
from ..modules.auth.dependencies import get_current_user


def _admin_emails() -> set[str]:
    return {email.strip().lower() for email in get_settings().admin_emails.split(",") if email.strip()}


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["email"].lower() not in _admin_emails():
        raise AppError("Not found", 404)
    return user


AdminUser = Annotated[dict, Depends(require_admin)]
