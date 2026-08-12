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

The app enforces its own rate limits (general API, auth, and AI tiers -- see
`app/core/security.py`). By default counters are in-memory, so they reset
per instance and don't coordinate across multiple replicas. Set `REDIS_URL`
to share counters across replicas instead; if Redis becomes unreachable,
limits fall back to per-instance memory automatically rather than failing
requests. Forward
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

Build and run the provided `Dockerfile` (it reads `PORT` at runtime, falling
back to 5000 locally -- required by platforms like Railway/Heroku that
assign the port dynamically), or run directly with an ASGI process manager:

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-5000}" --workers 2
```

Use a rolling or blue/green deployment. FastAPI's lifespan disposes the
SQLAlchemy connection pool during shutdown.

## Background job worker

Document/note indexing, memory extraction, and knowledge-graph/mind-map
rebuilds run as durable jobs (`app/core/jobs.py`) once `REDIS_URL` is set --
without it, they run inline in the request/response cycle instead (fine for
a single local dev instance, not for production). A durable queue needs a
**separate, always-running worker process** actually consuming it; nothing
drains the queue on its own.

Start command (same image, no HTTP server):

```bash
python -m app.core.jobs
```

### Railway: running it as a second service

1. In the Railway project, add a new service pointing at the same repo/image
   as the API service (same `Dockerfile`).
2. Set that service's config file to `railway.worker.json` (Settings →
   Config-as-code path, or `RAILWAY_CONFIG_FILE=railway.worker.json` as a
   service variable). This overrides the container's start command to
   `python -m app.core.jobs` instead of `docker-entrypoint.sh`, so the
   worker never runs `alembic upgrade head` itself -- only the API service
   does, exactly once per release.
3. Give the worker service the same environment variables as the API
   service (`DATABASE_URL`, `REDIS_URL`, AI provider keys, `S3_*`,
   `JOB_QUEUE_NAME`, `JOB_MAX_RETRIES`, etc.) -- it needs the same
   configuration to do the same work.
4. No public networking/domain is needed for the worker service; keep it on
   Railway's private network only.
5. Verify: enqueue a document upload, then check Railway logs for the worker
   service for `job_worker_started` followed by `job_completed` log lines
   (structured JSON, includes `job_id`, `job_type`, `attempt`,
   `duration_ms`, `final_state`). Restarting the API service mid-upload
   should not lose the job -- it stays queued in Redis and tracked in the
   `background_jobs` table until a worker (this one, or a newly deployed
   replacement) picks it up.

### Operational visibility

`GET /api/v1/admin/jobs/metrics` (admin-only, see `ADMIN_EMAILS`) reports
queue depth, oldest-queued-job age, running count, failed count, and
dead-letter count. `GET /api/v1/admin/jobs/dead-letter` lists dead-letter
jobs with their last error; `POST /api/v1/admin/jobs/{id}/retry` re-queues
one, `POST /api/v1/admin/jobs/{id}/discard` removes it permanently. A job
stuck `running` for more than 15 minutes (a worker that crashed mid-job) is
automatically reset to `queued` the next time any worker starts up.

## Phase 3 growth operations

Model routing is configured with `AI_FEATURE_PROVIDERS`, a JSON map from
feature to provider. Providers without a configured API key are skipped and
the normal fallback chain remains active. Example:

```text
AI_FEATURE_PROVIDERS={"chat":"openai","quiz":"groq","flashcards":"groq","mind_map":"gemini"}
```

Run the review-reminder sweep hourly using Railway Cron (no public domain):

```bash
python -m app.core.jobs --reminders
```

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
`SMTP_FROM_EMAIL`, and `APP_PUBLIC_URL`. Students must opt in from Settings;
delivery is deduplicated per student/local day. The admin-only
`GET /api/v1/analytics/funnel?days=30` endpoint reports distinct users by
activation stage and aggregate AI-answer approval rate.
