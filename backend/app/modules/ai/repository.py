from sqlalchemy import case, delete, func, literal, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..notes.model import Note
from .model import ChatMessage, Document, DocumentChunk, MessageSource
from .rag import ChunkRow

# --------------------------------------------------------------------------
# Chat messages
# --------------------------------------------------------------------------


async def find_recent_by_topic(db: AsyncSession, topic_id: int, limit: int) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.topic_id == topic_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = list(result.scalars().all())
    messages.reverse()
    return messages


async def create_exchange(
    db: AsyncSession, topic_id: int, user_message: str, assistant_message: str, mode: str = "tutor"
) -> dict[str, ChatMessage]:
    user_row = ChatMessage(topic_id=topic_id, role="user", message=user_message, mode=mode)
    assistant_row = ChatMessage(topic_id=topic_id, role="assistant", message=assistant_message, mode=mode)
    db.add_all([user_row, assistant_row])
    await db.flush()
    await db.refresh(user_row)
    await db.refresh(assistant_row)
    return {"userMessage": user_row, "assistantMessage": assistant_row}


async def find_recent_sparring_run(db: AsyncSession, topic_id: int, limit: int) -> list[ChatMessage]:
    """The contiguous tail of `mode='sparring'` messages for a topic -- the
    conversation history of whichever spar is currently in progress, since
    only one spar runs at a time per topic."""
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.topic_id == topic_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = list(result.scalars().all())
    run: list[ChatMessage] = []
    for message in messages:
        if message.mode != "sparring":
            break
        run.append(message)
    run.reverse()
    return run


async def delete_all_by_topic(db: AsyncSession, topic_id: int) -> int:
    result = await db.execute(delete(ChatMessage).where(ChatMessage.topic_id == topic_id))
    return result.rowcount or 0


# --------------------------------------------------------------------------
# Chunks (hybrid retrieval)
# --------------------------------------------------------------------------


def _chunk_row_columns():
    """Common SELECT list to build a `ChunkRow` from `document_chunks`
    joined with whichever source (note or document) owns it."""
    return (
        DocumentChunk.id.label("chunk_id"),
        case(
            (DocumentChunk.note_id.isnot(None), literal("note")),
            else_=literal("document"),
        ).label("source_type"),
        func.coalesce(DocumentChunk.note_id, DocumentChunk.document_id).label("source_id"),
        func.coalesce(Note.title, Document.title).label("source_title"),
        DocumentChunk.content.label("text"),
    )


def _chunk_source_join(stmt):
    return stmt.outerjoin(Note, Note.id == DocumentChunk.note_id).outerjoin(
        Document, Document.id == DocumentChunk.document_id
    )


async def list_topic_chunks(
    db: AsyncSession, topic_id: int, document_id: int | None = None
) -> list[ChunkRow]:
    """All chunks in a topic -- the BM25 candidate pool.

    When `document_id` is given, narrows to just that document's chunks (the
    user picked a specific file via the "/" document picker in the tutor).
    """
    stmt = _chunk_source_join(
        select(*_chunk_row_columns()).select_from(DocumentChunk)
    ).where(DocumentChunk.topic_id == topic_id)
    if document_id is not None:
        stmt = stmt.where(DocumentChunk.document_id == document_id)
    result = await db.execute(stmt)
    return [ChunkRow(**row._mapping) for row in result]


async def vector_search(
    db: AsyncSession,
    topic_id: int,
    query_embedding: list[float],
    limit: int,
    document_id: int | None = None,
) -> list[tuple[ChunkRow, float]]:
    """Nearest chunks by cosine distance, scoped to a topic (and optionally
    to a single document within it)."""
    distance = DocumentChunk.embedding.cosine_distance(query_embedding).label("distance")
    stmt = (
        _chunk_source_join(select(*_chunk_row_columns(), distance).select_from(DocumentChunk))
        .where(DocumentChunk.topic_id == topic_id, DocumentChunk.embedding.isnot(None))
        .order_by(distance)
        .limit(limit)
    )
    if document_id is not None:
        stmt = stmt.where(DocumentChunk.document_id == document_id)
    result = await db.execute(stmt)
    hits: list[tuple[ChunkRow, float]] = []
    for row in result:
        mapping = dict(row._mapping)
        cosine_distance = mapping.pop("distance")
        hits.append((ChunkRow(**mapping), 1 - cosine_distance))
    return hits


async def replace_note_chunks(
    db: AsyncSession,
    *,
    note_id: int,
    topic_id: int,
    chunks: list[str],
    embeddings: list[list[float] | None],
) -> None:
    """Delete a note's existing chunks and insert freshly chunked+embedded
    ones -- called whenever a note is created or its content changes."""
    await db.execute(delete(DocumentChunk).where(DocumentChunk.note_id == note_id))
    for index, (content, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
        db.add(
            DocumentChunk(
                topic_id=topic_id, note_id=note_id, chunk_index=index,
                content=content, embedding=embedding,
            )
        )


async def insert_document_chunks(
    db: AsyncSession,
    *,
    document_id: int,
    topic_id: int,
    chunks: list[str],
    embeddings: list[list[float] | None],
) -> None:
    """Delete-then-insert (like `replace_note_chunks`) so a re-run -- a
    retried/re-enqueued indexing job for the same document -- never
    duplicates chunks."""
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
    for index, (content, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
        db.add(
            DocumentChunk(
                topic_id=topic_id, document_id=document_id, chunk_index=index,
                content=content, embedding=embedding,
            )
        )


async def update_chunk_topic_for_note(db: AsyncSession, note_id: int, topic_id: int) -> None:
    """A note's chunks denormalize `topic_id` for fast topic-scoped
    retrieval; when a note moves between topics, repoint its existing
    chunks rather than paying to re-chunk/re-embed unchanged content."""
    await db.execute(
        update(DocumentChunk).where(DocumentChunk.note_id == note_id).values(topic_id=topic_id)
    )


async def record_message_sources(
    db: AsyncSession, *, message_id: int, sources: list[tuple[int | None, float | None]]
) -> None:
    for chunk_id, similarity_score in sources:
        db.add(
            MessageSource(message_id=message_id, chunk_id=chunk_id, similarity_score=similarity_score)
        )


# --------------------------------------------------------------------------
# Documents
# --------------------------------------------------------------------------


async def create_document(
    db: AsyncSession, *, topic_id: int, title: str, original_filename: str, content_type: str
) -> Document:
    document = Document(
        topic_id=topic_id, title=title, original_filename=original_filename,
        content_type=content_type, status="pending",
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)
    return document


async def set_document_storage_path(db: AsyncSession, document_id: int, storage_path: str) -> None:
    document = await db.get(Document, document_id)
    if document is not None:
        document.storage_path = storage_path


async def get_document(db: AsyncSession, document_id: int) -> Document | None:
    return await db.get(Document, document_id)


async def get_document_for_topic(
    db: AsyncSession, document_id: int, topic_id: int
) -> Document | None:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.topic_id == topic_id)
    )
    return result.scalar_one_or_none()


# Safety cap for the user-facing document list -- prevents an account that's
# uploaded thousands of documents to one topic from turning a routine list
# request into an unbounded table scan / multi-MB response. Ordered by
# recency, so the cap still returns the documents someone actually cares
# about. Internal callers that need the *complete* set (e.g. flashcard
# generation, which must consider every document) stay well under this in
# practice, but should not rely on this function for exhaustive results.
_DOCUMENT_LIST_CAP = 500


async def list_documents_by_topic(db: AsyncSession, topic_id: int) -> list[Document]:
    result = await db.execute(
        select(Document)
        .where(Document.topic_id == topic_id)
        .order_by(Document.created_at.desc())
        .limit(_DOCUMENT_LIST_CAP)
    )
    return list(result.scalars().all())


async def update_document_status(
    db: AsyncSession,
    document_id: int,
    *,
    status: str,
    error_message: str | None = None,
    extracted_text: str | None = None,
) -> None:
    document = await db.get(Document, document_id)
    if document is None:
        return
    document.status = status
    if error_message is not None:
        document.error_message = error_message
    if extracted_text is not None:
        document.extracted_text = extracted_text


async def delete_document(db: AsyncSession, document: Document) -> None:
    await db.delete(document)
