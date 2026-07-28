from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from ..core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    connect_args = {"ssl": True} if settings.database_ssl else {}
    return create_async_engine(
        settings.sqlalchemy_database_url,
        pool_size=settings.database_pool_max,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args=connect_args,
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False, autoflush=False)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


async def dispose_engine() -> None:
    await get_engine().dispose()
    get_engine.cache_clear()
    get_sessionmaker.cache_clear()
