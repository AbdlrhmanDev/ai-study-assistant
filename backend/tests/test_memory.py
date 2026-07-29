import json
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.memory import service as memory_service
from app.modules.memory.model import StudentMemory
from app.modules.users.model import User

MOCK_MEMORY_RESPONSE = json.dumps([
    {"type": "weakness", "key": "confuses mitosis and meiosis", "value": "Student mixes up mitosis and meiosis.", "confidence": 0.9},
])


async def _create_memory(db_session: AsyncSession, user: User, key: str = "likes examples") -> StudentMemory:
    memory = StudentMemory(
        user_id=user.id, memory_type="preference", key=key, value="Prefers worked examples.",
        confidence=0.8, reinforcement_count=1, last_reinforced_at=datetime.now(timezone.utc),
    )
    db_session.add(memory)
    await db_session.flush()
    return memory


async def test_extract_and_store_creates_memory_from_ai_response(
    db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_MEMORY_RESPONSE)

    await memory_service.extract_and_store(
        db_session, user_id=test_user.id, question="Why did I mix these up?", answer="Mitosis and meiosis differ in..."
    )

    memories = await memory_service.list_memories(db_session, test_user.id)
    assert len(memories) == 1
    assert memories[0]["key"] == "confuses mitosis and meiosis"


async def test_extract_and_store_never_raises_on_ai_failure(db_session: AsyncSession, test_user: User, monkeypatch):
    import app.modules.ai.provider as provider

    async def _boom(*_args, **_kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(provider, "generate", _boom)

    await memory_service.extract_and_store(
        db_session, user_id=test_user.id, question="Q", answer="A"
    )  # must not raise

    memories = await memory_service.list_memories(db_session, test_user.id)
    assert memories == []


async def test_list_memories_endpoint_returns_own_memories(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    await _create_memory(db_session, test_user)

    response = await authed_client.get("/api/v1/memory")

    assert response.status_code == 200
    assert len(response.json()["memories"]) == 1


async def test_update_memory_changes_value(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    memory = await _create_memory(db_session, test_user)

    response = await authed_client.patch(f"/api/v1/memory/{memory.id}", json={"value": "Updated fact."})

    assert response.status_code == 200
    assert response.json()["memory"]["value"] == "Updated fact."


async def test_update_memory_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    memory = await _create_memory(db_session, other_user)

    response = await authed_client.patch(f"/api/v1/memory/{memory.id}", json={"value": "Hijacked"})

    assert response.status_code == 404


async def test_delete_memory_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    memory = await _create_memory(db_session, test_user)

    delete_response = await authed_client.delete(f"/api/v1/memory/{memory.id}")
    assert delete_response.status_code == 204

    list_response = await authed_client.get("/api/v1/memory")
    assert list_response.json()["memories"] == []
