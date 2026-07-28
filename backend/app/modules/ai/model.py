from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, CheckConstraint, DateTime, Float, ForeignKey, Identity, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...core.config import get_settings
from ...db.base import Base

_EMBEDDING_DIM = get_settings().embedding_dimensions


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False, server_default="tutor")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name="chat_messages_role_check"),
        CheckConstraint(
            "char_length(trim(message)) > 0", name="chat_messages_message_not_empty"
        ),
        CheckConstraint("mode IN ('tutor', 'sparring', 'image')", name="chat_messages_mode_check"),
        Index("chat_messages_topic_id_index", "topic_id"),
        Index("chat_messages_topic_created_at_index", "topic_id", "created_at"),
    )


class Document(Base):
    """An uploaded study document (PDF/text), scoped to a topic."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','processing','completed','failed')",
            name="documents_status_check",
        ),
        CheckConstraint("char_length(trim(title)) > 0", name="documents_title_not_empty"),
        Index("documents_topic_id_index", "topic_id"),
    )


class DocumentChunk(Base):
    """A chunk of text (from a note OR an uploaded document) plus its
    embedding, used for hybrid (vector + BM25) retrieval."""

    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    note_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("notes.id", ondelete="CASCADE"), nullable=True
    )
    document_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Nullable: if the embedding provider fails at write time, the chunk is
    # still stored (and remains findable via BM25) rather than being lost.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(_EMBEDDING_DIM), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "(note_id IS NOT NULL AND document_id IS NULL) OR "
            "(note_id IS NULL AND document_id IS NOT NULL)",
            name="document_chunks_exactly_one_source",
        ),
        Index("document_chunks_topic_id_index", "topic_id"),
        Index("document_chunks_note_id_index", "note_id"),
        Index("document_chunks_document_id_index", "document_id"),
        Index(
            "document_chunks_embedding_hnsw_index",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class MessageSource(Base):
    """Which chunk(s) backed a given assistant chat message, for citation."""

    __tablename__ = "message_sources"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    message_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False
    )
    chunk_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True
    )
    similarity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (Index("message_sources_message_id_index", "message_id"),)
