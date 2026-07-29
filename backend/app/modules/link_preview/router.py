from fastapi import APIRouter, Query

from ...api.dependencies import CurrentUser
from . import service

router = APIRouter(prefix="/link-preview", tags=["link-preview"])


@router.get("")
async def link_preview(user: CurrentUser, url: str = Query(min_length=1, max_length=2000)):
    preview = await service.get_link_preview(url)
    return {"preview": preview.model_dump(mode="json")}
