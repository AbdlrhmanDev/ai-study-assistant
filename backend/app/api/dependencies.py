"""Re-exports of the dependencies route modules use most often, so routers
can `from ...api.dependencies import DbSession, CurrentUser` instead of
reaching into `db`/`modules.auth` directly."""

from ..db.dependencies import DbSession
from ..modules.auth.dependencies import CurrentUser, get_current_user

__all__ = ["DbSession", "CurrentUser", "get_current_user"]
