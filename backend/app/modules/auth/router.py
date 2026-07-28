from fastapi import APIRouter, Depends, Request, status

from ...core.exceptions import AppError
from ...core.security import check_auth_rate_limit, record_auth_failure
from ...db.dependencies import DbSession
from ...shared.responses import no_content
from . import service
from .dependencies import CurrentUser
from .schema import LoginIn, ProfileUpdate, RegisterIn

router = APIRouter(prefix="/auth", tags=["auth"])

# check_auth_rate_limit only tests-and-blocks (no side effect); the actual
# "count this attempt" hit happens in the except blocks below for the two
# realistic brute-force outcomes (bad credentials, duplicate email) --
# mirroring Express's `authRateLimiter` + `skipSuccessfulRequests: true`.
auth_rate_limited = [Depends(check_auth_rate_limit)]


@router.post("/register", status_code=status.HTTP_201_CREATED, dependencies=auth_rate_limited)
async def register(payload: RegisterIn, request: Request, db: DbSession):
    try:
        user = await service.register(
            db,
            request,
            name=payload.name,
            email=str(payload.email),
            password=payload.password,
        )
    except AppError:
        record_auth_failure(request)
        raise
    return {"user": user}


@router.post("/login", dependencies=auth_rate_limited)
async def login(payload: LoginIn, request: Request, db: DbSession):
    try:
        user = await service.login(db, request, email=str(payload.email), password=payload.password)
    except AppError:
        record_auth_failure(request)
        raise
    return {"user": user}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request):
    service.logout(request)
    return no_content()


@router.get("/me")
async def me(request: Request):
    return {"user": request.session.get("user")}


@router.patch("/me")
async def update_profile(
    payload: ProfileUpdate, request: Request, db: DbSession, user: CurrentUser
):
    updated = await service.update_profile(
        db,
        request,
        user["id"],
        name=payload.name,
        email=str(payload.email) if payload.email else None,
    )
    return {"user": updated}
