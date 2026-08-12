"""Citation quality and insufficient-evidence tests for the AI tutor chat
endpoint. These don't (and can't) verify an LLM's honesty deterministically
-- what they verify is the system's own responsibility: that retrieval
correctly finds and cites the right source material when it exists, and
that the prompt sent to the provider explicitly flags when none was
found (see `provider.build_input`'s "No relevant evidence was found"
fallback and `provider.INSTRUCTIONS`'s refusal instruction)."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai import provider, repository
from app.modules.ai.chunking import chunk_text
from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User, title: str = "Topic") -> Topic:
    topic = Topic(user_id=user.id, title=title, description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def _create_indexed_note(db_session: AsyncSession, topic: Topic, title: str, content: str) -> Note:
    """Creates a note and indexes it via BM25-searchable chunks (no
    embeddings -- vector search isn't needed to prove citation correctness,
    and skipping it avoids a real embedding-provider call in tests)."""
    note = Note(topic_id=topic.id, title=title, content=content)
    db_session.add(note)
    await db_session.flush()
    chunks = chunk_text(content, size=1200, overlap=180)
    await repository.replace_note_chunks(
        db_session, note_id=note.id, topic_id=topic.id, chunks=chunks, embeddings=[None] * len(chunks)
    )
    await db_session.flush()
    return note


async def test_chat_response_cites_the_note_containing_the_answer(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = await _create_topic(db_session, test_user)
    note = await _create_indexed_note(
        db_session, topic, "Mitochondria",
        "The mitochondria is the powerhouse of the cell, generating ATP through oxidative phosphorylation.",
    )
    mock_ai_generate("The mitochondria produces ATP for the cell.")

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/ai/chat", json={"question": "What does the mitochondria do?"}
    )

    assert response.status_code == 201
    sources = response.json()["sources"]
    assert len(sources) >= 1
    assert any(s["sourceType"] == "note" and s["sourceId"] == note.id for s in sources)


async def test_chat_response_does_not_cite_notes_from_a_different_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = await _create_topic(db_session, test_user, title="Biology")
    other_topic = await _create_topic(db_session, test_user, title="History")
    await _create_indexed_note(
        db_session, other_topic, "French Revolution",
        "The French Revolution began in 1789 and reshaped European politics.",
    )
    await _create_indexed_note(
        db_session, topic, "Photosynthesis",
        "Photosynthesis converts light energy into chemical energy stored in glucose.",
    )
    mock_ai_generate("Photosynthesis converts light into chemical energy.")

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/ai/chat", json={"question": "What is photosynthesis?"}
    )

    assert response.status_code == 201
    sources = response.json()["sources"]
    assert all(s["sourceTitle"] != "French Revolution" for s in sources)


def test_build_input_flags_insufficient_evidence_when_nothing_was_retrieved():
    prompt = provider.build_input(
        {"title": "Empty Topic", "description": None}, chunks=[], history=[], question="Explain quantum tunneling.",
    )

    assert "No relevant evidence was found in this topic." in prompt


async def test_chat_with_no_material_sends_insufficient_evidence_prompt_to_provider(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, monkeypatch
):
    topic = await _create_topic(db_session, test_user)
    captured_prompts: list[str] = []

    async def _capturing_generate(prompt: str, instructions: str = "") -> tuple[str, str, str]:
        captured_prompts.append(prompt)
        return "I don't have enough material on this topic yet to answer confidently.", "mock", "mock-model"

    monkeypatch.setattr(provider, "generate", _capturing_generate)

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/ai/chat", json={"question": "What is entropy?"}
    )

    assert response.status_code == 201
    assert response.json()["sources"] == []
    # A second `generate()` call fires in the background for memory
    # extraction ("TUTORING EXCHANGE...") -- only the first call is the
    # actual chat prompt this test cares about.
    assert "No relevant evidence was found in this topic." in captured_prompts[0]
