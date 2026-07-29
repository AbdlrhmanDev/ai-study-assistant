import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

from app.core.config import get_settings
from app.db.base import Base

# Import every ORM model module so it registers on Base.metadata. There is no
# central models.py -- this is the ONE place that must be updated when a new
# module gains a model.py, or autogenerate will silently miss its table.
from app.modules.auth.model import UserSession  # noqa: F401
from app.modules.ai.model import ChatMessage  # noqa: F401
from app.modules.agents.model import AgentSession  # noqa: F401
from app.modules.coach.model import StudyGoal  # noqa: F401
from app.modules.exams.model import Exam  # noqa: F401
from app.modules.flashcards.model import Flashcard  # noqa: F401
from app.modules.gamification.model import XpEvent  # noqa: F401
from app.modules.knowledge_graph.model import ConceptRelation  # noqa: F401
from app.modules.learning_style.model import LearningStyleProfile  # noqa: F401
from app.modules.mastery.model import Concept  # noqa: F401
from app.modules.memory.model import StudentMemory  # noqa: F401
from app.modules.mind_map.model import MindMap  # noqa: F401
from app.modules.notes.model import Note  # noqa: F401
from app.modules.quizzes.model import Quiz  # noqa: F401
from app.modules.study_history.model import StudyActivity  # noqa: F401
from app.modules.topics.model import Topic  # noqa: F401
from app.modules.users.model import User  # noqa: F401
from app.modules.workspace.model import WorkspacePage  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().sqlalchemy_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def _connect_and_migrate(connectable) -> None:
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)


async def run_migrations_online() -> None:
    settings = get_settings()
    # Mirror app/db/session.py's connect_args (ssl flag).
    connect_args: dict = {}
    if settings.database_ssl:
        connect_args["ssl"] = True

    connectable = create_async_engine(
        settings.sqlalchemy_database_url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    # A container's outbound networking (DNS resolution in particular) can
    # hang -- not just fail -- for the first several seconds right at boot,
    # and that hang isn't bounded by asyncpg's own `timeout` connect arg
    # (observed in production: a fresh container blocked completely silent
    # for the full 5-minute deploy healthcheck window with zero log output,
    # even with a `connect_args={"timeout": ...}` in place). Wrapping the
    # whole attempt in `asyncio.wait_for` bounds it regardless of which
    # layer -- DNS, TCP connect, TLS handshake -- is actually stuck, and
    # retrying with backoff lets a later attempt succeed once the
    # container's networking has finished settling.
    last_error: Exception | None = None
    for attempt in range(6):
        try:
            await asyncio.wait_for(_connect_and_migrate(connectable), timeout=15)
            last_error = None
            break
        except (OSError, TimeoutError) as error:
            last_error = error
            print(f"[migrations] connection attempt {attempt + 1} failed: {error!r}", flush=True)
            await asyncio.sleep(2**attempt)
    if last_error is not None:
        raise last_error

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
