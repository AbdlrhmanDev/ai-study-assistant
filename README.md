# AI Study Assistant

AI-powered study assistant for organizing topics and notes, chatting with an
AI tutor, and tracking study activity.

## Stack

- Frontend: React, Next.js/Vinext, TypeScript
- Backend: Node.js, Express, PostgreSQL
- AI providers: Gemini, Groq, or OpenAI
- Authentication: server-side sessions stored in PostgreSQL

## Project structure

- `frontend/` — web application
- `backend/` — REST API, AI integration, migrations, and tests

## Local setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Configure PostgreSQL and one AI provider API key.
4. Install dependencies in both directories.
5. Run `npm run db:migrate` inside `backend/`.
6. Start the backend and frontend development servers.

See `backend/PRODUCTION.md` before deploying.
