import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache

import structlog
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from ..core.config import get_settings

logger = structlog.get_logger("study_assistant")


def _register_query_instrumentation(engine: AsyncEngine) -> None:
    """Logs (and counts) queries slower than SLOW_QUERY_MS. Only the
    truncated, parameterized SQL text is logged -- never bound parameter
    values, which can contain note/document content or other private data."""
    sync_engine = engine.sync_engine

    @event.listens_for(sync_engine, "before_cursor_execute")
    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())

    @event.listens_for(sync_engine, "after_cursor_execute")
    def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
        start_times = conn.info.get("query_start_time")
        if not start_times:
            return
        duration_ms = (time.perf_counter() - start_times.pop()) * 1000
        if duration_ms < get_settings().slow_query_ms:
            return
        from ..core.metrics import SLOW_QUERIES

        SLOW_QUERIES.inc()
        logger.warning("slow_query_detected", duration_ms=round(duration_ms, 1), statement=statement[:300])


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    connect_args = {"ssl": True} if settings.database_ssl else {}
    engine = create_async_engine(
        settings.sqlalchemy_database_url,
        pool_size=settings.database_pool_max,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args=connect_args,
    )
    _register_query_instrumentation(engine)
    return engine


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False, autoflush=False)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


@asynccontextmanager
async def session_scope(db: AsyncSession | None) -> AsyncIterator[AsyncSession]:
    """Reuse a caller-supplied session when given one (a same-request inline
    job fallback, or a test) instead of always opening an independent
    connection -- an independent connection can't see another session's
    uncommitted work, which matters both for request-scoped inline
    execution and for tests using a rolled-back savepoint."""
    if db is not None:
        yield db
        return
    async with get_sessionmaker()() as owned_session:
        yield owned_session


async def dispose_engine() -> None:
    await get_engine().dispose()
    get_engine.cache_clear()
    get_sessionmaker.cache_clear()
