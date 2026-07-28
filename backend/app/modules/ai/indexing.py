import structlog
from fastapi import BackgroundTasks

from ...core.config import get_settings
from ...db.session import get_sessionmaker
from ..notes.model import Note
from . import repository
from .chunking import chunk_text
from .embedding import generate_embeddings
from .storage import get_storage_backend
from .text_extraction import extract_text

logger = structlog.get_logger("study_assistant")


async def _safe_generate_embeddings(chunks: list[str]) -> list[list[float] | None]:
    """Best-effort embedding: if the provider fails (outage, bad key), still
    return one `None` per chunk so the chunk text itself gets stored and
    stays findable via BM25 -- only vector search loses coverage for it."""
    if not chunks:
        return []
    try:
        return await generate_embeddings(chunks)
    except Exception:
        logger.warning("embedding_failed_storing_chunks_without_vectors", exc_info=True)
        return [None] * len(chunks)


async def _index_note(note_id: int) -> None:
    """Re-chunk and re-embed a note's content.

    Opens its own DB session: `BackgroundTasks` run *after* the response is
    sent, so the request's `Depends(get_db_session)` session is already
    closed by the time this executes (same reasoning as the session
    middleware's independent session in `core/security.py`).
    """
    async with get_sessionmaker()() as db:
        note = await db.get(Note, note_id)
        if note is None:
            return  # deleted before the task ran

        try:
            settings = get_settings()
            chunks = chunk_text(note.content, settings.rag_chunk_size, settings.rag_chunk_overlap)
            embeddings = await _safe_generate_embeddings(chunks)
            await repository.replace_note_chunks(
                db, note_id=note.id, topic_id=note.topic_id, chunks=chunks, embeddings=embeddings,
            )
            await db.commit()
        except Exception:
            await db.rollback()
            logger.warning("note_indexing_failed", note_id=note_id, exc_info=True)


def index_note_in_background(background_tasks: BackgroundTasks, note_id: int) -> None:
    background_tasks.add_task(_index_note, note_id)


async def _index_document(document_id: int) -> None:
    async with get_sessionmaker()() as db:
        document = await repository.get_document(db, document_id)
        if document is None:
            return

        try:
            await repository.update_document_status(db, document_id, status="processing")
            await db.commit()

            storage = get_storage_backend()
            raw_bytes = storage.read(document.storage_path)
            extracted_text = extract_text(document.content_type, raw_bytes)

            settings = get_settings()
            chunks = chunk_text(
                extracted_text, settings.rag_chunk_size, settings.rag_chunk_overlap
            )
            embeddings = await _safe_generate_embeddings(chunks)

            await repository.insert_document_chunks(
                db, document_id=document.id, topic_id=document.topic_id,
                chunks=chunks, embeddings=embeddings,
            )
            await repository.update_document_status(
                db, document_id, status="completed", extracted_text=extracted_text
            )
            await db.commit()
        except Exception as error:
            await db.rollback()
            logger.warning("document_indexing_failed", document_id=document_id, exc_info=True)
            await repository.update_document_status(
                db, document_id, status="failed", error_message=str(error)[:500]
            )
            await db.commit()


def index_document_in_background(background_tasks: BackgroundTasks, document_id: int) -> None:
    background_tasks.add_task(_index_document, document_id)
