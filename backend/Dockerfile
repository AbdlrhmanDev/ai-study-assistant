FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

# PORT is injected at runtime by platforms like Railway/Heroku and varies
# per deployment; 5000 is only the local-dev fallback.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://localhost:' + os.environ.get('PORT', '5000') + '/health')" || exit 1

# Apply migrations, then start the API. Run behind a process manager /
# orchestrator that restarts on crash; `--workers` can be raised once the app
# is confirmed CPU-bound enough to benefit (it's I/O-bound: DB + LLM calls).
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-5000}
