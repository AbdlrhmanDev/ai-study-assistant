"""Account security and lifecycle endpoints: change password, session
listing/revocation, account deletion, and full data export. Profile
read/update stays at /auth/me for frontend compatibility (see
modules.auth.router); this is the home for the rest of first-class
/users functionality."""

from fastapi import APIRouter, File, Request, UploadFile, status
from fastapi.responses import RedirectResponse, Response

from ...api.dependencies import CurrentUser, DbSession
from ...shared.responses import no_content
from . import repository, service
from .schema import ChangePasswordIn, ReauthenticateIn

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/me/password")
async def change_password(payload: ChangePasswordIn, request: Request, db: DbSession, user: CurrentUser):
    return await service.change_password(
        db, request, int(user["id"]),
        current_password=payload.currentPassword, new_password=payload.newPassword,
    )


@router.get("/me/sessions")
async def list_sessions(request: Request, db: DbSession, user: CurrentUser):
    return {"sessions": await service.list_sessions(db, request, int(user["id"]))}


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(session_id: str, db: DbSession, user: CurrentUser):
    await service.revoke_session(db, int(user["id"]), session_id)
    return no_content()


@router.delete("/me/sessions")
async def revoke_other_sessions(request: Request, db: DbSession, user: CurrentUser):
    return await service.revoke_other_sessions(db, request, int(user["id"]))


@router.post("/me/delete")
async def delete_account(payload: ReauthenticateIn, request: Request, db: DbSession, user: CurrentUser):
    return await service.delete_account(db, request, int(user["id"]), password=payload.password)


@router.get("/me/export")
async def export_account(db: DbSession, user: CurrentUser):
    return await service.export_account_data(db, int(user["id"]))


@router.post("/me/profile-image")
async def upload_profile_image(
    db: DbSession, user: CurrentUser, image: UploadFile = File(...)
):
    raw_bytes = await image.read(service.PROFILE_IMAGE_MAX_BYTES + 1)
    updated = await service.update_profile_image(
        db, int(user["id"]), raw_bytes=raw_bytes, content_type=image.content_type
    )
    return {"user": service.public_user(updated)}


@router.get("/me/profile-image")
async def get_profile_image(db: DbSession, user: CurrentUser):
    profile = await repository.get_by_id(db, int(user["id"]))
    if profile is None or not profile.profile_image_path:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    from ..ai.storage import get_storage_backend

    storage = get_storage_backend()
    signed_url = storage.signed_download_url(profile.profile_image_path)
    if signed_url:
        return RedirectResponse(signed_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    return Response(
        content=storage.read(profile.profile_image_path),
        media_type=profile.profile_image_content_type or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=300"},
    )
