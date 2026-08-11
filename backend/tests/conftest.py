"""Test harness: each test runs inside a Postgres transaction that is rolled
back afterward, so tests can run against the real dev database (schema
already migrated) without leaving any data behind. `join_transaction_mode`
absorbs the `await db.commit()` calls sprinkled through the app's service
layer -- they only close a SAVEPOINT, never the outer transaction."""

import os
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

# Tests must never inherit a developer or production database URL from
# backend/.env. CI sets TEST_DATABASE_URL explicitly; local runs use the
# pgvector database created by docker-compose.yml.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    # docker-compose.override.yml intentionally publishes the Studia test
    # database on 5433 so it cannot accidentally connect to a developer's
    # unrelated PostgreSQL instance on the conventional 5432 port.
    "postgresql://postgres:postgres@localhost:5433/ai_study_assistant_test",
)
os.environ["DATABASE_SSL"] = "false"
os.environ["NODE_ENV"] = "test"

# Tests must never touch real object storage either -- backend/.env can
# (and in production-configured checkouts, does) point STORAGE_BACKEND at a
# real S3/R2 bucket, which pydantic-settings would otherwise pick up here
# too since explicit env vars only override what's set below. Force local
# filesystem storage into a repo-local scratch dir, wiped at the start of
# each test session, regardless of what .env configures.
_TEST_UPLOAD_DIR = Path(__file__).resolve().parent.parent / ".test-uploads"
shutil.rmtree(_TEST_UPLOAD_DIR, ignore_errors=True)
_TEST_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
os.environ["STORAGE_BACKEND"] = "local"
os.environ["UPLOAD_DIR"] = str(_TEST_UPLOAD_DIR)

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dependencies import get_db_session
from app.db.session import get_engine
from app.main import app as fastapi_app
from app.modules.auth.dependencies import get_current_user
from app.modules.users.model import User


def pytest_configure() -> None:
    """Create repo-local pytest roots before pytest's tmp_path fixture runs.

    Some managed Windows environments deny access to the user-wide Temp
    directory, and pytest does not create the parent of a custom basetemp.
    """
    runtime_root = Path(__file__).resolve().parent.parent / ".test-runtime"
    runtime_root.mkdir(parents=True, exist_ok=True)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _reset_background_jobs_table() -> None:
    """`app.modules.jobs.service` and `app.modules.usage.service` both
    intentionally open independent sessions and commit for real (a durable
    job must survive the request that enqueued it; a usage event must
    survive even if the request that triggered it later fails) -- meaning,
    unlike everything else here, their writes are NOT undone by
    `db_session`'s savepoint rollback. Wipe both tables once per test
    session so assertions don't see rows left over from a previous run."""
    from sqlalchemy import text

    engine = get_engine()
    try:
        async with engine.begin() as connection:
            await connection.execute(text("TRUNCATE TABLE background_jobs"))
            await connection.execute(text("TRUNCATE TABLE usage_events"))
            await connection.execute(text("TRUNCATE TABLE cleanup_runs"))
    except Exception as exc:
        pytest.exit(
            "Unable to connect to the isolated Studia test database. "
            "Run `docker compose up -d db`, apply the test migrations, and retry. "
            f"Current TEST_DATABASE_URL targets {os.environ['DATABASE_URL']!r}. "
            f"Original error: {exc}",
            returncode=2,
        )


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
