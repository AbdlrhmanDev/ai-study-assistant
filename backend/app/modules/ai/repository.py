from sqlalchemy import case, delete, func, literal, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..notes.model import Note
from ..topics.model import Topic
from ..workspace.model import WorkspacePage
from .model import ChatMessage, Document, DocumentChunk, MessageFeedback, MessageSource
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


async def get_message_with_owner(db: AsyncSession, message_id: int) -> tuple[ChatMessage, int] | None:
    """Returns (message, topic_owner_user_id), or None if the message
    doesn't exist."""
    stmt = (
        select(ChatMessage, Topic.user_id)
        .join(Topic, Topic.id == ChatMessage.topic_id)
        .where(ChatMessage.id == message_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return row[0], row[1]


async def upsert_message_feedback(
    db: AsyncSession, *, message_id: int, rating: int, reason: str | None
) -> MessageFeedback:
    stmt = (
        pg_insert(MessageFeedback)
        .values(message_id=message_id, rating=rating, reason=reason)
        .on_conflict_do_update(
            index_elements=[MessageFeedback.message_id],
            set_={"rating": rating, "reason": reason, "updated_at": func.now()},
        )
        .returning(MessageFeedback)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


# --------------------------------------------------------------------------
# Chunks (hybrid retrieval)
# --------------------------------------------------------------------------


def _chunk_row_columns():
    """Common SELECT list to build a `ChunkRow` from `document_chunks`
    joined with whichever source (note, document, or workspace page) owns
    it."""
    return (
        DocumentChunk.id.label("chunk_id"),
        case(
            (DocumentChunk.note_id.isnot(None), literal("note")),
            (DocumentChunk.document_id.isnot(None), literal("document")),
            else_=literal("workspace_page"),
        ).label("source_type"),
        func.coalesce(
            DocumentChunk.note_id, DocumentChunk.document_id, DocumentChunk.workspace_page_id
        ).label("source_id"),
        func.coalesce(Note.title, Document.title, WorkspacePage.title).label("source_title"),
        DocumentChunk.content.label("text"),
    )


def _chunk_source_join(stmt):
    return (
        stmt.outerjoin(Note, Note.id == DocumentChunk.note_id)
        .outerjoin(Document, Document.id == DocumentChunk.document_id)
        .outerjoin(WorkspacePage, WorkspacePage.id == DocumentChunk.workspace_page_id)
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
    embedding_model: str | None = None,
) -> None:
    """Delete a note's existing chunks and insert freshly chunked+embedded
    ones -- called whenever a note is created or its content changes."""
    await db.execute(delete(DocumentChunk).where(DocumentChunk.note_id == note_id))
    for index, (content, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
        db.add(
            DocumentChunk(
                topic_id=topic_id, note_id=note_id, chunk_index=index,
                content=content, embedding=embedding,
                embedding_model=embedding_model if embedding is not None else None,
            )
        )


async def replace_workspace_page_chunks(
    db: AsyncSession,
    *,
    workspace_page_id: int,
    topic_id: int,
    chunks: list[str],
    embeddings: list[list[float] | None],
    embedding_model: str | None = None,
) -> None:
    """Same delete-then-insert pattern as `replace_note_chunks`. Called with
    an empty `chunks` list to clear a page's chunks entirely (e.g. it was
    unlinked from its topic)."""
    await db.execute(delete(DocumentChunk).where(DocumentChunk.workspace_page_id == workspace_page_id))
    for index, (content, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
        db.add(
            DocumentChunk(
                topic_id=topic_id, workspace_page_id=workspace_page_id, chunk_index=index,
                content=content, embedding=embedding,
                embedding_model=embedding_model if embedding is not None else None,
            )
        )


async def insert_document_chunks(
    db: AsyncSession,
    *,
    document_id: int,
    topic_id: int,
    chunks: list[str],
    embeddings: list[list[float] | None],
    embedding_model: str | None = None,
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
                embedding_model=embedding_model if embedding is not None else None,
            )
        )


async def count_stale_chunks(db: AsyncSession, topic_id: int, current_embedding_model: str) -> int:
    """Chunks whose vector came from a different provider/model than the
    one configured now -- e.g. `EMBEDDING_PROVIDER` was switched from Gemini
    to OpenAI. Chunks with no embedding at all (provider was down at index
    time) aren't "stale" in this sense; they're covered by the existing
    per-document retry flow instead."""
    result = await db.execute(
        select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.topic_id == topic_id,
            DocumentChunk.embedding.is_not(None),
            or_(
                DocumentChunk.embedding_model.is_(None),
                DocumentChunk.embedding_model != current_embedding_model,
            ),
        )
    )
    return result.scalar_one()


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
    db: AsyncSession, *, topic_id: int, title: str, original_filename: str, content_type: str,
    file_size_bytes: int | None = None,
) -> Document:
    document = Document(
        topic_id=topic_id, title=title, original_filename=original_filename,
        content_type=content_type, status="pending", file_size_bytes=file_size_bytes,
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)
    return document


async def sum_document_bytes_for_user(db: AsyncSession, user_id: int) -> int:
    """Total storage a user currently occupies across every topic --
    documents already deleted don't count (the row, and this sum with it,
    is gone the moment `delete_document` removes it)."""
    result = await db.execute(
        select(func.coalesce(func.sum(Document.file_size_bytes), 0))
        .select_from(Document)
        .join(Topic, Topic.id == Document.topic_id)
        .where(Topic.user_id == user_id)
    )
    return result.scalar_one()


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
