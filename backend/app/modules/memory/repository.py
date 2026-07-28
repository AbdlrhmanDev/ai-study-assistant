from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import StudentMemory


async def find_by_key(db: AsyncSession, user_id: int, key: str) -> StudentMemory | None:
    stmt = select(StudentMemory).where(
        StudentMemory.user_id == user_id, func.lower(StudentMemory.key) == key.lower()
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession, *, user_id: int, memory_type: str, key: str, value: str, confidence: float
) -> StudentMemory:
    memory = StudentMemory(
        user_id=user_id, memory_type=memory_type, key=key[:200], value=value, confidence=confidence
    )
    db.add(memory)
    await db.flush()
    return memory


async def reinforce(db: AsyncSession, memory: StudentMemory, *, value: str, confidence_bump: float = 0.15) -> StudentMemory:
    memory.value = value
    memory.confidence = min(1.0, memory.confidence + confidence_bump)
    memory.reinforcement_count += 1
    memory.last_reinforced_at = datetime.now(timezone.utc)
    await db.flush()
    return memory


async def list_by_user(db: AsyncSession, user_id: int) -> list[StudentMemory]:
    stmt = (
        select(StudentMemory)
        .where(StudentMemory.user_id == user_id)
        .order_by(StudentMemory.confidence.desc(), StudentMemory.last_reinforced_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_top_for_prompt(db: AsyncSession, user_id: int, limit: int = 8, min_confidence: float = 0.3) -> list[StudentMemory]:
    stmt = (
        select(StudentMemory)
        .where(StudentMemory.user_id == user_id, StudentMemory.confidence >= min_confidence)
        .order_by(StudentMemory.confidence.desc(), StudentMemory.last_reinforced_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_for_user(db: AsyncSession, memory_id: int, user_id: int) -> StudentMemory | None:
    stmt = select(StudentMemory).where(StudentMemory.id == memory_id, StudentMemory.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update(db: AsyncSession, memory: StudentMemory, *, value: str | None) -> StudentMemory:
    if value is not None:
        memory.value = value
    await db.flush()
    await db.refresh(memory)
    return memory


async def delete(db: AsyncSession, memory: StudentMemory) -> None:
    await db.delete(memory)
