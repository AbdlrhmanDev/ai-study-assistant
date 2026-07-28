from fastapi import BackgroundTasks

from ...db.session import get_sessionmaker
from . import service


async def _extract_memory(user_id: int, question: str, answer: str) -> None:
    """Opens its own DB session: BackgroundTasks run after the response is
    sent, so the request's session is already closed by the time this
    executes (same reasoning as ai/indexing.py)."""
    async with get_sessionmaker()() as db:
        await service.extract_and_store(db, user_id=user_id, question=question, answer=answer)


def extract_memory_in_background(
    background_tasks: BackgroundTasks, user_id: int, question: str, answer: str
) -> None:
    background_tasks.add_task(_extract_memory, user_id, question, answer)
