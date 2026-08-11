# AI Study Assistant API (FastAPI)

The backend is a Python/FastAPI service, organized into feature modules
(`app/modules/{users,auth,topics,notes,ai,study_history}`) each with their own
model/schema/repository/service/router, plus shared `core/` (config, security,
logging, exceptions), `db/` (SQLAlchemy async engine/session), and `shared/`
utilities. It preserves the existing `/api/v1` contract used by the Next.js
frontend and adds topic-scoped RAG to the AI tutor.

Sessions are server-side (a `user_sessions` Postgres table, not a
client-readable cookie); auth, AI, and general API traffic are rate-limited;
and structured JSON logs redact secrets. See `PRODUCTION.md` for the
production checklist.

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 5000
```

Database schema changes are managed with Alembic. Apply all migrations with:

```powershell
alembic upgrade head
```

To generate a new migration after changing a model in `app/modules/*/model.py`:

```powershell
alembic revision --autogenerate -m "describe the change"
```

Useful URLs:

- API: `http://localhost:5000/api/v1`
- OpenAPI: `http://localhost:5000/docs`
- Health: `http://localhost:5000/health`

## RAG behavior

Retrieval is **hybrid**: vector similarity search (pgvector) plus BM25-style
lexical search, fused with Reciprocal Rank Fusion (RRF). Requires the
[pgvector](https://github.com/pgvector/pgvector) Postgres extension --
on Windows this means building it from source (MSVC + `nmake`); see the
project notes for the exact steps used to set it up locally. The migration
runs `CREATE EXTENSION IF NOT EXISTS vector` automatically once the
extension binary is installed on the server.

**Indexing (write time)** -- both notes and uploaded documents feed the same
pipeline, in `app/modules/ai/indexing.py`, scheduled via FastAPI
`BackgroundTasks` so it never blocks the note-save/upload response:

1. extract text (`text_extraction.py`: plain text passthrough, PDF via `pypdf`);
2. chunk it (`chunking.py`, paragraph-aware with overlap);
3. embed each chunk (`embedding.py`, `EMBEDDING_PROVIDER=gemini|openai` --
   independent from `AI_PROVIDER` since Groq has no embeddings API; both
   providers are standardized on 768 dimensions so switching providers never
   needs a schema migration);
4. store chunks + embeddings in `document_chunks` (pgvector `Vector(768)`
   column, HNSW index). If the embedding call fails, the chunk is still
   stored with a `NULL` embedding -- it stays findable via BM25, it just
   won't surface via vector search until re-indexed.

Uploaded documents (`POST /api/v1/topics/{topicId}/documents`, multipart)
return `202` immediately with `status: "pending"`; poll
`GET /api/v1/documents/{documentId}` for `pending -> processing ->
completed|failed`. The original file is kept on local disk
(`UPLOAD_DIR`, behind a small `StorageBackend` interface in `storage.py` so
an S3-compatible backend can be dropped in later) alongside the extracted
text in the database.

**Retrieval (chat time)**, in `app/modules/ai/retrieval.py`:

1. verify the selected topic belongs to the signed-in student;
2. embed the question and run a pgvector cosine-distance query, scoped to
   the topic;
3. independently score all of the topic's chunks with BM25
   (`rag.py::score_bm25`);
4. fuse both ranked lists via RRF and take the top `RAG_TOP_K`;
5. if embedding generation or the vector query fails for any reason
   (provider outage, nothing indexed yet), fall back to BM25 alone rather
   than failing the chat request;
6. send the fused evidence + recent chat history to the configured
   `AI_PROVIDER` model, persist which chunks backed the answer
   (`message_sources` table), and return `sources` citing either a note or
   a document (`sourceType`, `sourceId`, `sourceTitle`, `excerpt`, `score`,
   and `similarity` when a vector match was found).

## Tests

Tests need a real PostgreSQL instance with pgvector (the schema uses
Postgres-specific identity columns, JSONB, vector columns, and functional
indexes -- no SQLite). Tests deliberately ignore the database URL in `.env`
to prevent accidental use of a developer or production database. They use
`TEST_DATABASE_URL`, defaulting to the local Compose database
`ai_study_assistant_test`.

```powershell
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_study_assistant_test"
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:DATABASE_SSL="false"
python -m alembic upgrade head
python -m pytest
```

The suite covers pure logic and API/database integration, including auth,
CRUD ownership, document upload, AI-provider fallback, generation flows,
rate limiting, exports, and security headers.
