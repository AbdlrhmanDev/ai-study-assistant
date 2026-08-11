from fastapi import APIRouter, status

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["knowledge-graph"])


@router.get("/topics/{topic_id}/knowledge-graph")
async def get_graph(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.get_graph(db, topic_id, user["id"])


@router.post("/topics/{topic_id}/knowledge-graph/rebuild", status_code=status.HTTP_202_ACCEPTED)
async def rebuild_graph(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.request_graph_rebuild(db, topic_id, user["id"])


@router.get("/concepts/{concept_id}")
async def get_concept(concept_id: int, db: DbSession, user: CurrentUser):
    return await service.get_concept_detail(db, concept_id, user["id"])
