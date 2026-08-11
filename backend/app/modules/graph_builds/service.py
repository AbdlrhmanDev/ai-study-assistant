from sqlalchemy.ext.asyncio import AsyncSession

from . import repository


async def get_build_status(db: AsyncSession, *, topic_id: int, build_type: str) -> dict:
    row = await repository.get_status(db, topic_id=topic_id, build_type=build_type)
    if row is None:
        return {"status": "completed", "errorMessage": None}
    return {"status": row.status, "errorMessage": row.error_message}
