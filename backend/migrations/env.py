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
from app.modules.cleanup.model import CleanupRun  # noqa: F401
from app.modules.coach.model import StudyGoal  # noqa: F401
from app.modules.exams.model import Exam  # noqa: F401
from app.modules.flashcards.model import Flashcard  # noqa: F401
from app.modules.gamification.model import XpEvent  # noqa: F401
from app.modules.graph_builds.model import TopicBuildStatus  # noqa: F401
from app.modules.jobs.model import BackgroundJob  # noqa: F401
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
from app.modules.usage.model import UsageEvent  # noqa: F401

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


async def run_migrations_online() -> None:
    settings = get_settings()
    # Mirror app/db/session.py's connect_args (ssl flag). A cold-boot
    # network/DNS stall that outlasts the deploy platform's healthcheck
    # window is handled at the process level instead (see
    # docker-entrypoint.sh's `timeout` wrapper) -- a blocking syscall
    # already running in a thread-pool worker can't actually be interrupted
    # by asyncio-level cancellation (confirmed in production: wrapping this
    # in asyncio.wait_for never fired even once across a full 5-minute
    # hang), so only an OS-level process kill can unstick it.
    connect_args: dict = {}
    if settings.database_ssl:
        connect_args["ssl"] = True

    connectable = create_async_engine(
        settings.sqlalchemy_database_url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
