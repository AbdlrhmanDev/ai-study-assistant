from fastapi import APIRouter, status

from ...api.dependencies import CurrentUser, DbSession
from ...shared.responses import no_content
from . import service
from .model import Topic
from .schema import TopicCreate, TopicOut, TopicUpdate

router = APIRouter(prefix="/topics", tags=["topics"])


def _serialize(topic: Topic) -> dict:
    return TopicOut.model_validate(topic).model_dump(mode="json")


@router.get("")
async def list_topics(db: DbSession, user: CurrentUser):
    topics = await service.list_topics(db, user["id"])
    return {"topics": [_serialize(topic) for topic in topics]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_topic(payload: TopicCreate, db: DbSession, user: CurrentUser):
    topic = await service.create_topic(db, user["id"], payload)
    return {"topic": _serialize(topic)}


@router.get("/{topic_id}")
async def get_topic(topic_id: int, db: DbSession, user: CurrentUser):
    topic = await service.get_topic(db, topic_id, user["id"])
    return {"topic": _serialize(topic)}


@router.patch("/{topic_id}")
async def update_topic(topic_id: int, payload: TopicUpdate, db: DbSession, user: CurrentUser):
    topic = await service.update_topic(db, topic_id, user["id"], payload)
    return {"topic": _serialize(topic)}


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(topic_id: int, db: DbSession, user: CurrentUser):
    await service.delete_topic(db, topic_id, user["id"])
    return no_content()
