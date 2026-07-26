# AI Study Assistant Backend

Express backend scaffold for the AI Study Assistant project.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and adjust values for your local database/session secret.

Create the PostgreSQL database, then apply the schema and start the API:

```sql
CREATE DATABASE ai_study_assistant;
```

```bash
npm run db:migrate
npm run dev
```

The connection string in `.env` uses this format:

```env
DATABASE_URL=postgres://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME
```

## Structure

- `src/config` - environment and session configuration
- `src/db` - database pool and migrations
- `src/middleware` - request middleware and error handling
- `src/modules` - feature modules
- `src/utils` - shared helpers
- `tests` - backend tests
