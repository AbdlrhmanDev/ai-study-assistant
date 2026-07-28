from fastapi import APIRouter, status

from ...api.dependencies import CurrentUser, DbSession
from . import service
from .schema import AgentDispatchIn

router = APIRouter(tags=["agents"])


@router.post("/agents/dispatch", status_code=status.HTTP_201_CREATED)
async def dispatch(payload: AgentDispatchIn, db: DbSession, user: CurrentUser):
    return await service.dispatch(db, user["id"], payload.message, payload.topicId)


@router.get("/agents/sessions/{session_id}/trace")
async def get_trace(session_id: int, db: DbSession, user: CurrentUser):
    return await service.get_trace(db, session_id, user["id"])
