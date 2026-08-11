# Studia — AI Study Assistant

Studia is a full-stack study platform with topics, notes, document RAG, an AI
tutor, quizzes, exams, flashcards, study planning, analytics, and progress
tracking.

## Stack

- Frontend: Node.js 22.13+, React 19, Next.js 16/Vinext, TypeScript
- Backend: Python 3.11+, FastAPI, PostgreSQL 16
- Retrieval: topic-scoped RAG over student notes
- Infrastructure: pgvector and Redis 7
- AI providers: Gemini, Groq, or OpenAI
- Authentication: signed HTTP-only cookie sessions

## Project structure

- `frontend/` — web application
- `backend/` — REST API, AI integration, migrations, and tests

## Recommended local setup with Docker

Requirements: Docker Desktop with Compose v2.

1. Copy `backend/.env.example` to `backend/.env` and add at least one AI provider key.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Start PostgreSQL/pgvector and Redis: `docker compose up -d db redis`.
4. Install dependencies and apply migrations using the native setup below.
5. Start both application services, or run everything with `docker compose up --build`.

The Compose database initialization creates both `ai_study_assistant` and
`ai_study_assistant_test`, with pgvector enabled in each database.

## Native development setup

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 5000
```

### Frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open Studia at <http://localhost:3000> and the API documentation at
<http://localhost:5000/docs>.

## Verification

With the local database running, prepare and test the backend:

```powershell
cd backend
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_study_assistant_test"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:DATABASE_SSL="false"
python -m alembic upgrade head
python -m alembic check
python -m pytest
```

Verify the frontend:

```powershell
cd frontend
npm ci
npm run lint -- --max-warnings=0
npm test
npx playwright install chromium
npm run test:e2e
```

`npm test` performs a production build before running the frontend unit tests.
The Playwright suite covers registration/login, core study routes, document
upload UI, and dense-page mobile navigation with API responses isolated from
external services.

## Demo data

After applying the development database migrations:

```powershell
cd backend
python -m scripts.seed_demo
```

This creates an idempotent local account, `demo@studia-demo.com`, with password
`studia-demo-2026` and a starter biology topic. Never use this account or
password in a public environment.

## Run with Docker

Make sure `backend/.env` contains a valid AI provider API key, then run:

```sh
docker compose up --build
```

Open the app at <http://localhost:3000>. The API and its interactive
documentation are available at <http://localhost:5000/docs>.

Stop the containers with:

```sh
docker compose down
```

Use `docker compose down -v` only when you intentionally want to delete the
local PostgreSQL data volume.

## Continuous integration

`.github/workflows/ci.yml` runs frontend lint/test/build, backend migrations
and tests against PostgreSQL/pgvector, dependency audits, and secret scanning.
Configure GitHub branch protection for `main` to require these checks before
merging. Repository administrators must enable that setting in GitHub; it
cannot be enforced by files in this repository alone.

See `backend/PRODUCTION.md` before deploying.
