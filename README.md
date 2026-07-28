# AI Study Assistant

AI-powered study assistant for organizing topics and notes, chatting with an
AI tutor, and tracking study activity.

## Stack

- Frontend: React, Next.js/Vinext, TypeScript
- Backend: Python, FastAPI, PostgreSQL
- Retrieval: topic-scoped RAG over student notes
- AI providers: Gemini, Groq, or OpenAI
- Authentication: signed HTTP-only cookie sessions

## Project structure

- `frontend/` — web application
- `backend/` — REST API, AI integration, migrations, and tests

## Local setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Configure PostgreSQL and one AI provider API key.
4. Install `backend/requirements.txt` and the frontend dependencies.
5. Run `python -m app.db.migrate` inside `backend`.
6. Run `python -m uvicorn app.main:app --reload --port 5000` in `backend/`.
7. Start the frontend development server.

See `backend/PRODUCTION.md` before deploying.
