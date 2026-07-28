from fastapi import APIRouter

from ...api.dependencies import CurrentUser, DbSession
from . import service
from .schema import LearningStyleWeightsIn

router = APIRouter(tags=["learning-style"])


@router.get("/learning-style")
async def get_learning_style(db: DbSession, user: CurrentUser):
    return await service.get_profile(db, user["id"])


@router.patch("/learning-style")
async def update_learning_style(payload: LearningStyleWeightsIn, db: DbSession, user: CurrentUser):
    return await service.update_profile(db, user["id"], payload.model_dump())


@router.post("/learning-style/reset")
async def reset_learning_style(db: DbSession, user: CurrentUser):
    return await service.reset_profile(db, user["id"])
