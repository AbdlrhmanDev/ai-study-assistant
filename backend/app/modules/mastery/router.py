from fastapi import APIRouter, Query

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["mastery"])


@router.get("/topics/{topic_id}/mastery/weak")
async def list_weak_concepts(
    topic_id: int, db: DbSession, user: CurrentUser, limit: int = Query(10, ge=1, le=50)
):
    concepts = await service.list_weak_concepts(db, topic_id, user["id"], limit)
    return {"concepts": concepts}


@router.get("/topics/{topic_id}/mastery/{concept_id}/history")
async def get_concept_history(topic_id: int, concept_id: int, db: DbSession, user: CurrentUser):
    return await service.get_concept_history(db, topic_id, concept_id, user["id"])
