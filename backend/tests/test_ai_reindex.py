from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.ai import repository
from app.modules.ai.chunking import chunk_text
from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User, title: str = "Topic") -> Topic:
    topic = Topic(user_id=user.id, title=title, description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def _create_note_with_chunk(
    db_session: AsyncSession, topic: Topic, *, embedding: list[float] | None, embedding_model: str | None
) -> Note:
    note = Note(topic_id=topic.id, title="Note", content="Some durable study content.")
    db_session.add(note)
    await db_session.flush()
    chunks = chunk_text(note.content, size=1200, overlap=180)
    await repository.replace_note_chunks(
        db_session, note_id=note.id, topic_id=topic.id, chunks=chunks,
        embeddings=[embedding] * len(chunks), embedding_model=embedding_model,
    )
    await db_session.flush()
    return note


async def test_reindex_status_reports_zero_stale_when_model_matches_current(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    settings = get_settings()
    current_model = f"{settings.embedding_provider}:{settings.embedding_model}"
    await _create_note_with_chunk(
        db_session, topic, embedding=[0.1] * settings.embedding_dimensions, embedding_model=current_model
    )

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/reindex-status")

    assert response.status_code == 200
    body = response.json()
    assert body["staleChunkCount"] == 0
    assert body["currentEmbeddingModel"] == current_model


async def test_reindex_status_flags_chunks_embedded_by_a_different_model(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    settings = get_settings()
    await _create_note_with_chunk(
        db_session, topic, embedding=[0.1] * settings.embedding_dimensions, embedding_model="openai:text-embedding-3-small",
    )

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/reindex-status")

    assert response.status_code == 200
    assert response.json()["staleChunkCount"] >= 1


async def test_reindex_status_flags_pre_migration_chunks_with_no_recorded_model(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """Chunks that existed before `embedding_model` was tracked have
    embedding_model=NULL even though they do have a vector -- these must
    count as stale (unknown model) rather than silently being skipped."""
    topic = await _create_topic(db_session, test_user)
    settings = get_settings()
    await _create_note_with_chunk(
        db_session, topic, embedding=[0.1] * settings.embedding_dimensions, embedding_model=None,
    )

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/reindex-status")

    assert response.status_code == 200
    assert response.json()["staleChunkCount"] >= 1


async def test_reindex_status_ignores_chunks_with_no_embedding_at_all(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    """A chunk that never got an embedding (provider was down) is a BM25-
    only-coverage gap, not a stale-model problem -- it shouldn't count."""
    topic = await _create_topic(db_session, test_user)
    await _create_note_with_chunk(db_session, topic, embedding=None, embedding_model=None)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/reindex-status")

    assert response.status_code == 200
    assert response.json()["staleChunkCount"] == 0


async def test_reindex_status_for_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/reindex-status")

    assert response.status_code == 404


async def test_reindex_topic_queues_every_note_and_completed_document(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, monkeypatch
):
    from app.modules.ai import embedding

    monkeypatch.setattr(
        embedding, "_embed_gemini_sync", lambda texts: [[0.1] * get_settings().embedding_dimensions for _ in texts]
    )
    topic = await _create_topic(db_session, test_user)
    await _create_note_with_chunk(db_session, topic, embedding=None, embedding_model=None)
    await _create_note_with_chunk(db_session, topic, embedding=None, embedding_model=None)

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/reindex")

    assert response.status_code == 202
    body = response.json()
    assert body["notesQueued"] == 2
    assert body["documentsQueued"] == 0
