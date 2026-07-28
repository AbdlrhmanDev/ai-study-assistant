from typing import Annotated

from fastapi import Depends, Request

from ...core.exceptions import AppError


def get_current_user(request: Request) -> dict:
    user = request.session.get("user")
    if not user:
        raise AppError("Authentication required", 401)
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]
