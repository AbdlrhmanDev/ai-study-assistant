from fastapi import APIRouter

from ...api.dependencies import CurrentUser, DbSession
from . import service

router = APIRouter(tags=["goal-prediction"])


@router.get("/goal-predictions")
async def list_predictions(db: DbSession, user: CurrentUser):
    return {"predictions": await service.list_predictions(db, user["id"])}


@router.get("/topics/{topic_id}/goal-prediction")
async def get_prediction_for_topic(topic_id: int, db: DbSession, user: CurrentUser):
    return await service.get_prediction_for_topic(db, topic_id, user["id"])
