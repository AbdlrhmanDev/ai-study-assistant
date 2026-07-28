# FastAPI production checklist

## Required environment

Set `NODE_ENV=production` and provide `DATABASE_URL`, `CLIENT_ORIGINS`,
`SESSION_SECRET`, the selected `AI_PROVIDER` and its API key, and the
selected `EMBEDDING_PROVIDER` and its API key (independent from
`AI_PROVIDER` -- Groq has no embeddings API). Use a random `SESSION_SECRET`
containing at least 32 characters and serve the API over HTTPS.

The **pgvector** Postgres extension must be installed on the database server
before running migrations (`CREATE EXTENSION IF NOT EXISTS vector` is part
of the migration, but the extension binary itself has to already be present
on the server -- most managed Postgres providers support it via an
allowlist; self-hosted Postgres needs it built/installed manually).

## Health checks

- Liveness: `GET /health`
- Readiness (checks PostgreSQL): `GET /health/ready`

Configure the hosting platform to use readiness before routing traffic to a new
instance.

## Security and operations

The app enforces its own rate limits in-process (general API, auth, and AI
tiers -- see `app/core/security.py`); these use in-memory counters, so they
reset per instance and don't coordinate across multiple replicas. Put a
shared rate limiter in front (API gateway or a Redis-backed limiter) if you
run more than one instance and need a single global limit. Forward
stdout/stderr to the hosting platform's logs (JSON in production, with
password/cookie/authorization fields redacted). Every response includes
`X-Request-Id`.

Run `alembic upgrade head` before a new release (the provided `Dockerfile`
does this automatically on container start). Enable automated PostgreSQL
backups and test restore procedures.

Sessions are stored server-side in the `user_sessions` table; there's nothing
to migrate off of, but note that dropping/truncating that table logs every
user out.

Uploaded documents are written to local disk (`UPLOAD_DIR`, `STORAGE_BACKEND=local`)
alongside their extracted text and embeddings in Postgres. Local disk storage
does **not** survive across replicas or ephemeral container restarts --
either pin uploads to a single persistent-disk instance, or implement an
object-storage `StorageBackend` (see `app/modules/ai/storage.py`) before
running more than one instance or a platform with ephemeral filesystems.

## Deployment

Build and run the provided `Dockerfile`, or run directly with an ASGI process
manager:

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 5000 --workers 2
```

Use a rolling or blue/green deployment. FastAPI's lifespan disposes the
SQLAlchemy connection pool during shutdown.
