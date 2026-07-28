import asyncio
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI

if sys.platform == "win32":
    # asyncpg is incompatible with Windows' default ProactorEventLoop
    # (connections silently die across event-loop boundaries / on
    # keep-alive ping). SelectorEventLoop is what asyncpg expects.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from .api.v1.router import api_router
from .core.config import get_settings
from .core.exceptions import register_exception_handlers
from .core.logging import RequestContextMiddleware, configure_logging
from .core.security import (
    BodySizeLimitMiddleware,
    SessionMiddleware,
    limiter,
    rate_limit_exceeded_handler,
)
from .db.session import dispose_engine, get_sessionmaker

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
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
    except Exception:
        return JSONResponse({"status": "unavailable"}, status_code=503)


app.include_router(api_router)
