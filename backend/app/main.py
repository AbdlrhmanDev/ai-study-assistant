import asyncio
import sys
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI

if sys.platform == "win32":
    # asyncpg is incompatible with Windows' default ProactorEventLoop
    # (connections silently die across event-loop boundaries / on
    # keep-alive ping). SelectorEventLoop is what asyncpg expects.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from .api.v1.router import api_router
from .core.config import get_settings
from .core.exceptions import register_exception_handlers
from .core.logging import RequestContextMiddleware, configure_logging, logger
from .core.metrics import MetricsMiddleware
from .core.security import (
    BodySizeLimitMiddleware,
    SessionMiddleware,
    limiter,
    rate_limit_exceeded_handler,
)
from .db.session import dispose_engine, get_sessionmaker

configure_logging()
settings = get_settings()
if settings.sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.node_env,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # bcrypt hashing (app/core/security.py), embedding generation
    # (app/modules/ai/embedding.py), and the AI provider client
    # (app/modules/ai/provider.py) all offload blocking work onto anyio's
    # shared threadpool via run_in_threadpool. Its default cap is 40 -- a
    # burst of concurrent logins/registrations hashing at bcrypt rounds=12
    # can exhaust that pool and queue up unrelated AI requests behind it (or
    # vice versa). Raise the cap so one workload can't starve the other.
    anyio.to_thread.current_default_thread_limiter().total_tokens = 100
    yield
    await dispose_engine()


app = FastAPI(
    title="AI Study Assistant API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
register_exception_handlers(app)
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Middleware is applied outermost-to-innermost in reverse call order (Starlette
# wraps each add_middleware() call around the previous one), so the LAST call
# here (CORS) runs FIRST on the way in / LAST on the way out.
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SessionMiddleware)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=100_000)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(MetricsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
@limiter.exempt
async def health():
    return {"status": "ok"}


@app.get("/health/ready")
@limiter.exempt
async def readiness():
    try:
        async with get_sessionmaker()() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as exc:
        logger.error(
            "readiness_database_check_failed",
            error_type=type(exc).__name__,
            error=str(exc),
        )
        return JSONResponse({"status": "unavailable"}, status_code=503)


@app.get("/metrics", include_in_schema=False)
@limiter.exempt
async def metrics():
    from .core import metrics as metrics_module
    from .db.session import get_engine
    from .modules.jobs import service as jobs_service

    try:
        job_metrics = await jobs_service.get_metrics()
        metrics_module.QUEUE_DEPTH.set(job_metrics["queueDepth"])
        metrics_module.QUEUE_OLDEST_JOB_AGE.set(job_metrics["oldestQueuedAgeSeconds"] or 0)
        metrics_module.JOBS_RUNNING.set(job_metrics["running"])
        metrics_module.JOBS_FAILED.set(job_metrics["failed"])
        metrics_module.JOBS_DEAD_LETTER.set(job_metrics["deadLetter"])
    except Exception:
        logger.warning("job_metrics_refresh_failed", exc_info=True)
    try:
        pool = get_engine().pool
        metrics_module.DB_POOL_SIZE.set(pool.size())
        metrics_module.DB_POOL_CHECKED_OUT.set(pool.checkedout())
    except Exception:
        logger.warning("db_pool_metrics_refresh_failed", exc_info=True)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.include_router(api_router)
