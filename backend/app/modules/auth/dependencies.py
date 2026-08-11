from typing import Annotated

from fastapi import Depends, Request

from ...core.exceptions import AppError


async def get_current_user(request: Request) -> dict:
    """Return the session user and bind it to this async request context.

    Usage metering uses a ``ContextVar`` so provider calls several layers
    below the router can attribute an event without threading ``user_id``
    through every service signature.  This dependency must remain async:
    FastAPI runs synchronous dependencies in a worker thread, and ContextVar
    writes made there do not propagate back to the endpoint task.
    """
    user = request.session.get("user")
    if not user:
        raise AppError("Authentication required", 401)
    from ..usage.service import set_current_user
    set_current_user(int(user["id"]))
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]
