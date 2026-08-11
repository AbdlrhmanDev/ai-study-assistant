from ...db.session import get_sessionmaker
from . import service


async def _extract_memory(user_id: int, question: str, answer: str) -> None:
    """Opens its own DB session: BackgroundTasks run after the response is
    sent, so the request's session is already closed by the time this
    executes (same reasoning as ai/indexing.py)."""
    async with get_sessionmaker()() as db:
        await service.extract_and_store(db, user_id=user_id, question=question, answer=answer)


async def enqueue_memory_extraction(user_id: int, question: str, answer: str) -> str:
    from ...core.jobs import enqueue
    from ...core.config import get_settings
    if not get_settings().redis_url:
        await _extract_memory(user_id, question, answer)
        return "inline-development"
    return await enqueue(
        "memory.extract", {"user_id": user_id, "question": question, "answer": answer}
    )
