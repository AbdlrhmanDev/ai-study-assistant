"""Test harness: each test runs inside a Postgres transaction that is rolled
back afterward, so tests can run against the real dev database (schema
already migrated) without leaving any data behind. `join_transaction_mode`
absorbs the `await db.commit()` calls sprinkled through the app's service
layer -- they only close a SAVEPOINT, never the outer transaction."""

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dependencies import get_db_session
from app.db.session import get_engine
from app.main import app as fastapi_app
from app.modules.auth.dependencies import get_current_user
from app.modules.users.model import User


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = get_engine()
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        name="Export Test User",
        email=f"export-test-{uuid.uuid4()}@example.com",
        password_hash="not-a-real-hash",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
    user = User(
        name="Other User",
        email=f"other-test-{uuid.uuid4()}@example.com",
        password_hash="not-a-real-hash",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def override_get_db_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    fastapi_app.dependency_overrides[get_db_session] = override_get_db_session
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    fastapi_app.dependency_overrides.pop(get_db_session, None)


@pytest_asyncio.fixture
async def authed_client(client: AsyncClient, test_user: User) -> AsyncIterator[AsyncClient]:
    def override_get_current_user() -> dict:
        return {"id": test_user.id, "name": test_user.name, "email": test_user.email}

    fastapi_app.dependency_overrides[get_current_user] = override_get_current_user
    yield client
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_ai_generate(monkeypatch):
    """Stubs `ai.provider.generate` so quiz/exam/flashcard generation (and
    rubric grading) doesn't make real network calls to an AI provider.
    Call with a raw response string; each call sets the response for every
    subsequent `provider.generate()` until changed again."""
    import app.modules.ai.provider as provider

    def _set(response_text: str) -> None:
        async def _fake_generate(prompt: str, instructions: str = "") -> tuple[str, str, str]:
            return response_text, "mock", "mock-model"

        monkeypatch.setattr(provider, "generate", _fake_generate)

    _set("[]")
    return _set
