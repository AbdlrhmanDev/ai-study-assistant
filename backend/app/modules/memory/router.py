from fastapi import APIRouter, status

from ...api.dependencies import CurrentUser, DbSession
from ...shared.responses import no_content
from . import service
from .schema import MemoryUpdate

router = APIRouter(tags=["memory"])


@router.get("/memory")
async def list_memories(db: DbSession, user: CurrentUser):
    memories = await service.list_memories(db, user["id"])
    return {"memories": memories}


@router.patch("/memory/{memory_id}")
async def update_memory(memory_id: int, payload: MemoryUpdate, db: DbSession, user: CurrentUser):
    memory = await service.update_memory(db, memory_id, user["id"], payload.value)
    return {"memory": memory}


@router.delete("/memory/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(memory_id: int, db: DbSession, user: CurrentUser):
    await service.delete_memory(db, memory_id, user["id"])
    return no_content()
