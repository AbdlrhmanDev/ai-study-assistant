import structlog

from ...core.config import get_settings
from ...db.session import get_sessionmaker
from ..notes.model import Note
from ..topics.model import Topic
from ..workspace.model import WorkspacePage
from . import repository
from .chunking import chunk_text
from .embedding import generate_embeddings
from .storage import get_storage_backend
from .text_extraction import extract_text

logger = structlog.get_logger("study_assistant")


async def _safe_generate_embeddings(
    chunks: list[str], *, user_id: int | None = None
) -> list[list[float] | None]:
    """Best-effort embedding: if the provider fails (outage, bad key), still
    return one `None` per chunk so the chunk text itself gets stored and
    stays findable via BM25 -- only vector search loses coverage for it."""
    if not chunks:
        return []
    try:
        return await generate_embeddings(chunks, user_id=user_id)
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
            topic = await db.get(Topic, note.topic_id)
            settings = get_settings()
            chunks = chunk_text(note.content, settings.rag_chunk_size, settings.rag_chunk_overlap)
            embeddings = await _safe_generate_embeddings(
                chunks, user_id=topic.user_id if topic else None
            )
            await repository.replace_note_chunks(
                db, note_id=note.id, topic_id=note.topic_id, chunks=chunks, embeddings=embeddings,
                embedding_model=f"{settings.embedding_provider}:{settings.embedding_model}",
            )
            await db.commit()
        except Exception:
            await db.rollback()
            logger.warning("note_indexing_failed", note_id=note_id, exc_info=True)


async def enqueue_note_index(note_id: int) -> str:
    from ...core.jobs import enqueue
    from ...core.logging import current_correlation_id
    if not get_settings().redis_url:
        await _index_note(note_id)
        return "inline-development"
    return await enqueue(
        "note.index", {"note_id": note_id}, idempotency_key=f"note.index:{note_id}",
        correlation_id=current_correlation_id(),
    )


def _flatten_block_text(blocks: list[dict]) -> str:
    """Depth-first join of every block's `content` field -- the same text a
    reader would see scanning down the page, regardless of nesting."""
    lines = []
    for block in blocks:
        text = (block.get("content") or "").strip()
        if text:
            lines.append(text)
        lines.append(_flatten_block_text(block.get("children") or []))
    return "\n".join(line for line in lines if line)


async def _index_workspace_page(workspace_page_id: int) -> None:
    """Re-chunk and re-embed a workspace page's content -- only meaningful
    for pages linked to a topic, since retrieval is always topic-scoped.
    Called with an unlinked page (or one with no text) to clear any chunks
    it previously had."""
    async with get_sessionmaker()() as db:
        page = await db.get(WorkspacePage, workspace_page_id)
        if page is None:
            return

        try:
            settings = get_settings()
            content = _flatten_block_text(page.blocks or []) if page.topic_id is not None else ""
            chunks = chunk_text(content, settings.rag_chunk_size, settings.rag_chunk_overlap) if content else []
            topic = await db.get(Topic, page.topic_id) if page.topic_id is not None else None
            embeddings = await _safe_generate_embeddings(
                chunks, user_id=topic.user_id if topic else None
            )
            await repository.replace_workspace_page_chunks(
                db, workspace_page_id=page.id, topic_id=page.topic_id or 0,
                chunks=chunks, embeddings=embeddings,
                embedding_model=f"{settings.embedding_provider}:{settings.embedding_model}",
            )
            await db.commit()
        except Exception:
            await db.rollback()
            logger.warning("workspace_page_indexing_failed", workspace_page_id=workspace_page_id, exc_info=True)


async def enqueue_workspace_page_index(workspace_page_id: int) -> str:
    from ...core.jobs import enqueue
    from ...core.logging import current_correlation_id
    if not get_settings().redis_url:
        await _index_workspace_page(workspace_page_id)
        return "inline-development"
    return await enqueue(
        "workspace_page.index", {"workspace_page_id": workspace_page_id},
        idempotency_key=f"workspace_page.index:{workspace_page_id}",
        correlation_id=current_correlation_id(),
    )


async def _index_document(document_id: int) -> None:
    async with get_sessionmaker()() as db:
        document = await repository.get_document(db, document_id)
        if document is None:
            return

        try:
            await repository.update_document_status(db, document_id, status="processing")
            await db.commit()

            topic = await db.get(Topic, document.topic_id)
            storage = get_storage_backend()
            raw_bytes = storage.read(document.storage_path)
            extracted_text = extract_text(document.content_type, raw_bytes)

            settings = get_settings()
            chunks = chunk_text(
                extracted_text, settings.rag_chunk_size, settings.rag_chunk_overlap
            )
            embeddings = await _safe_generate_embeddings(
                chunks, user_id=topic.user_id if topic else None
            )

            await repository.insert_document_chunks(
                db, document_id=document.id, topic_id=document.topic_id,
                chunks=chunks, embeddings=embeddings,
                embedding_model=f"{settings.embedding_provider}:{settings.embedding_model}",
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


async def enqueue_document_index(document_id: int) -> str:
    from ...core.jobs import enqueue
    from ...core.logging import current_correlation_id
    if not get_settings().redis_url:
        await _index_document(document_id)
        return "inline-development"
    return await enqueue(
        "document.index", {"document_id": document_id},
        idempotency_key=f"document.index:{document_id}",
        correlation_id=current_correlation_id(),
    )
