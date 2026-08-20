Studia — Technical Documentation

Studia: Full Technical Documentation
Scope: complete reference for the Studia AI Study Assistant — a full-stack web app with a Next.js/React frontend and a FastAPI/PostgreSQL backend. Compiled from a direct audit of the codebase (not from planning docs) as of 2026-08-12.

1. Product summary
Studia is an AI-powered study companion. A student creates topics, feeds each one with notes and uploaded documents (PDF/text), and then studies that material through a set of AI-backed tools that all read from the same source content:

An AI tutor chat that answers questions grounded in the topic's own notes/documents (RAG), plus a debate-style "Socratic Sparring" mode and a multi-agent "ask my agents" free-form mode.
Flashcards (SM-2 spaced repetition), quizzes (casual, adaptive-difficulty-capable), and exams (formal, timed, Bloom's-Taxonomy-scored) — all AI-generated from the topic's material.
A knowledge graph (AI-extracted concept graph, mastery-colored) and a mind map (AI-generated structural outline) per topic.
A study coach that builds a daily study plan from exam dates and weak concepts, and a goal prediction engine that forecasts exam readiness.
A mistake notebook, weekly report, study history timeline, and cross-topic analytics dashboard.
A Notion-style workspace block editor for free-form notes, independent of the topic system but optionally linked into RAG.
Gamification (XP, levels, streaks) threaded through every graded interaction.
Everything is scoped per-user; every AI feature runs against swappable LLM providers (OpenAI, Google Gemini, Groq) with automatic fallback, per-feature usage quotas, and cost tracking, positioning the product for a metered/tiered SaaS model (beta and pro plan tiers already exist in config, though billing/Stripe integration is not yet implemented).

2. Tech stack
Layer	Technology
Frontend framework	Next.js 16.2.6 via vinext 0.0.50 (a Vite + React Server Components runtime, Next-API-compatible), React 19.2.6, TypeScript 5.9.3
Frontend styling	Tailwind CSS 4.2.1 + a hand-built CSS custom-property token system (app/styles/tokens.css)
Frontend deploy	Cloudflare Workers (wrangler, @cloudflare/vite-plugin)
Frontend tooling	ESLint 9, Playwright + @axe-core/playwright (e2e + accessibility), Sentry (@sentry/react), lucide-react icons
Backend framework	FastAPI 0.141 on Starlette, Uvicorn
Backend language	Python ≥ 3.11
Database	PostgreSQL + pgvector extension (vector embeddings for RAG), SQLAlchemy 2.0 (async, asyncpg driver), Alembic migrations
Cache / queue transport	Redis (rate limiting, idempotency cache, background-job transport) — degrades gracefully to in-memory/inline when unset
Object storage	Pluggable: local filesystem (dev) or S3-compatible (boto3) — R2 / S3 / MinIO / B2
AI providers	OpenAI, Google Gemini (google-genai), Groq — multi-provider with automatic fallback, configured per feature
Email	Stdlib smtplib (no third-party ESP) — verification, password reset, review reminders
Observability	structlog (structured logs), Sentry (errors, both sides), Prometheus (prometheus-client, /metrics)
Testing	Backend: pytest + pytest-asyncio, moto (mocked S3), fakeredis. Frontend: Playwright e2e, a Node built-in-test-runner unit test
3. System architecture
Browser
  │  same-origin fetch, cookie session, credentials: include
  ▼
Next.js app (vinext / Cloudflare Worker)
  │  server-side rewrites()  /api/v1/* → BACKEND_INTERNAL_URL
  ▼
FastAPI backend (/api/v1/*, /auth/*, /health, /metrics)
  │
  ├─ PostgreSQL (+ pgvector)         — system of record for everything, including job durability
  ├─ Redis                          — rate limiting, idempotency cache, job queue transport (optional)
  ├─ S3-compatible object storage    — uploaded documents, profile images
  ├─ OpenAI / Gemini / Groq          — LLM + embeddings, routed per feature, automatic fallback
  └─ SMTP                           — verification / reset / reminder emails
Why the frontend proxies instead of calling the backend cross-origin: the app deliberately routes every API call through the frontend's own origin (/api/v1/*, rewritten server-side to the real backend URL) so the session cookie stays first-party. A direct cross-origin call would be blocked or silently dropped by mobile Safari/Chrome Intelligent Tracking Prevention, logging users out right after login — this is documented in code comments in both app/lib/api.ts and next.config.ts on the frontend.

Authentication is not JWT. It's a classic server-side session: an opaque random token (secrets.token_urlsafe(32)) lives in an httpOnly cookie (__Host-sid in production), hashed and looked up in a user_sessions Postgres table on every request. There is no JWT anywhere in the codebase. Sessions regenerate on login (fixation protection), have a sliding TTL, and support multi-session visibility/revocation from Settings.

No WebSockets or SSE. Every AI interaction — chat, quiz/exam/flashcard generation, tutor responses — is a synchronous request/response JSON call. The two exceptions (knowledge graph and mind map rebuilds, which can take longer) use an async-job + 202 Accepted + client-polling pattern instead of a push channel.

4. Backend
4.1 Layout and conventions
app/
  core/      cross-cutting: config, security/sessions, mail, exceptions, metrics, logging, jobs, idempotency, admin gate
  api/       router aggregation (app/api/v1/router.py mounts every module's router under /api/v1)
  db/        async engine/session, declarative Base, DI helpers
  shared/    pagination, standard error/response shapes, shared type aliases
  modules/   one folder per domain (see §4.3) — each typically has router.py, service.py, model.py, schema.py
Base URL layout: most endpoints live under /api/v1/...; auth is mounted separately at /auth/... (for frontend compatibility); topics and study_history are mounted at the root path rather than under /api/v1. App-level routes: GET /health, GET /health/ready, GET /metrics (Prometheus). Roughly 164 total HTTP endpoints across ~25 mounted routers.

4.2 Core (app/core/)
config.py — pydantic-settings, env-driven. Holds DB URL, session secret, CORS origins, rate-limit thresholds, three-provider AI config (per-provider model selection), RAG tuning (chunk size/overlap, hybrid retrieval top-k, RRF k), embedding provider/model, upload limits, S3/storage config, SMTP config, a per-feature AI quota table, and plan tiers (beta / pro, each with storage cap, monthly request limit, feature multiplier). validate_production() refuses to boot in production with dev-default secrets, missing provider keys, non-S3 storage, or no Redis URL.
security.py — bcrypt password hashing (12 rounds, off the event loop); SessionMiddleware (session store, fixation protection, sliding TTL, CSRF defense via Origin allow-listing on state-changing requests); rate limiting via slowapi/limits (Redis-backed when available, fails open on Redis outage); a separate failed-attempts-only limiter for auth endpoints; a 100KB JSON body-size cap (larger for multipart uploads).
mail.py — plain smtplib sender used by verification, password reset, and review-reminder emails.
exceptions.py — one AppError type + handlers for validation (422) and unhandled (500) errors, producing one consistent {message, details?, requestId?} shape across the whole API.
metrics.py — Prometheus counters/histograms for HTTP requests/latency, AI provider requests/latency by provider+model+outcome, job queue depth, DB pool stats, slow queries, auth failures.
logging.py — structlog + a request-context middleware binding a request ID that correlates frontend → backend → job → AI-provider-call logs.
jobs.py — the durable background-job queue/worker (see §4.5).
idempotency.py — short-TTL request-dedup cache for Idempotency-Key headers on generation endpoints, plus a longer-lived (24h default) content-addressed artifact cache so identical quiz/exam/flashcard/mind-map generations are served without a repeat (paid) AI call until the source material changes.
admin.py — admin-email allow-list gate used by usage/analytics admin endpoints.
4.3 Modules (domain-by-domain)
Module	Purpose	Key endpoints (representative)	Notable logic
auth	Registration, login/logout, email verify, forgot/reset password	POST /register, /login, /logout, GET /me, /verify-email/{token}, /forgot-password, /reset-password	Anti-enumeration forgot-password (identical response either way); reset revokes all sessions
users	Account security — distinct from the profile surface in auth	POST /me/password, GET/DELETE /me/sessions, POST /me/delete, GET /me/export, POST /me/profile-image	Account deletion cascades every owned record and is idempotent/retry-safe; export excludes secrets
ai	Tutor chat, RAG, document upload/indexing	POST /topics/{id}/ai/chat, /ai/chat/image, POST /topics/{id}/documents, /documents/{id}/retry, /topics/{id}/reindex	Hybrid RAG (BM25 + pgvector cosine, fused via Reciprocal Rank Fusion, BM25-only fallback); multi-provider LLM with bounded retry + rate-limit-aware failover; magic-byte upload validation + optional ClamAV scan; per-plan storage quota
agents	Free-form request routing to specialist agents	POST /agents/dispatch, GET /agents/sessions/{id}/trace	LLM intent classifier with a regex-based (EN+AR) local fallback; 6 specialist agents (tutor, planner, quiz/exam/flashcard generators, researcher); full step trace persisted
analytics	Cross-module personal progress overview	GET /analytics/overview	7-day trend, weak/strong concept counts, per-topic XP/mastery breakdown
cleanup	Scheduled data-hygiene audit trail	GET /runs	Runs 4 independent sweeps (abandoned uploads, expired sessions, dead-letter jobs, stale usage events), records counts-only rows
coach	Daily study-plan generation	GET /coach/plan/today, POST /coach/plan/regenerate, GET/PUT /topics/{id}/study-goal	Reads only Mastery's weak-concept list (deliberately decoupled from Knowledge Graph/Mind Map); ranks by urgency/exam-proximity; fits a per-day time budget; LLM narration with deterministic fallback
exams	Timed, formal, Bloom's-scored exams	list/generate/get/publish/delete, edit/regenerate question, attempts (start/answer/submit/results), analytics	Draft-preview-then-publish workflow; rubric grading with quoted-evidence breakdown per criterion; scored per Bloom's level, not per concept; no adaptive difficulty
export	User-facing data export	GET /topics/{id}/notes/export, /flashcards/export, /reports/progress	CSV/Markdown/PDF streaming downloads
flashcards	Spaced-repetition flashcards	CRUD, generate, review, due, stats, CSV import/export, bulk archive	Classic SM-2 algorithm (isolated pure function); ease factor floor 1.3; every review returns a "why scheduled" explainability object; leech detection (forgotten 3+ times)
gamification	XP, levels, streaks	GET /topics/{id}/level, GET /streak	Fixed XP rules per action, deduplicated milestone bonuses; streak extends once per graded action, never on mere app-open
goal_prediction	Exam-readiness forecasting	GET /goal-predictions, /topics/{id}/goal-prediction	Aggregate mastery + trailing-window daily-gain-rate vs. days-to-exam → on_track/at_risk/behind classification, LLM-narrated
graph_builds	Shared rebuild-status/cooldown (no own router)	—	Enforces a shared 2-minute rebuild cooldown for knowledge graph and mind map (waived on a failed build so retries aren't throttled)
growth	Product telemetry, review reminders, admin funnel/retention	POST /product-events, GET/PUT /reminders/preferences, admin /analytics/funnel, /analytics/retention	Scheduled reminder emails (per-user local-hour/timezone/min-due-cards, deduped daily); weekly-cohort retention analytics
jobs	Admin control of the background-job queue	GET /metrics, GET /dead-letter, POST /{id}/retry, /discard	See §4.5
knowledge_graph	AI-extracted, mastery-colored concept graph	GET/rebuild /topics/{id}/knowledge-graph, GET /concepts/{id}	LLM extracts concepts + typed relations (prerequisite/related/contrasts/part_of) as strict JSON; dedupe + confidence filtering (<0.5 dropped); needs ≥3 concepts to render
learning_style	Infers preferred study modality	GET/PATCH /learning-style, POST /reset	6-axis weighted scoring from activity counts; auto-recomputes unless manually overridden
link_preview	URL metadata scraping for chat/note links	GET /	SSRF-hardened: resolves every A/AAAA record and rejects private/loopback/link-local/metadata-IP targets, re-checked on each of up to 3 manually-followed redirects; 512KB/5s cap
mastery	Per-concept skill scoring (source of truth for coach/KG/goal-prediction)	GET /topics/{id}/mastery/weak, /mastery/{concept_id}/history	EMA toward each new quality signal with a shrinking learning rate; forgetting decay applied only at read time, never baked into storage; confidence saturates after 5 events
memory	Durable per-student facts for tutor personalization	GET /memory, PATCH/DELETE /memory/{id}	LLM extracts ≤3 facts/exchange as background job; matched-by-key facts are reinforced, not duplicated; injected into tutor system prompt as "student context"
mind_map	Structural outline (no mastery/relation data)	GET/rebuild /topics/{id}/mind-map	Max 3 levels, max 6 children/node; content-addressed cache keyed on material signature
notes	Freeform per-topic notes	list/search/create/move/get/update/delete	Feeds RAG indexing identically to documents
plans	Resolves current plan tier + quotas (no billing yet)	GET /me	Scales default per-feature AI limits by plan feature_multiplier
quizzes	Casual, adaptive-capable practice quizzes	generate/get/publish/delete, edit/regenerate question, attempts, analytics	Per-type grading; per-concept accuracy roll-up; difficulty-calibration analytics (assigned vs. observed, flags top-5 miscalibrated); AI "diagnosis" + single-question "drill" on wrong answers; feeds mastery + XP
study_history	Append-only activity log	GET /study-history, /stats	record_activity_safely() never raises — logging must never break the real flow
study_insights	Mistakes review, weekly report, global search	GET /mistakes, /weekly-report, /study-search	Powers the frontend command palette (ILIKE search fanned across 7 content types, 8 results/type)
topics	Top-level container for all content	CRUD	404s (not 403s) on another user's topic to avoid leaking existence
usage	AI usage metering, quotas, admin cost dashboards	GET /usage/me, admin /summary, /failures, /top-cost	See §4.6
workspace	Notion-style block pages, optionally topic-linked	CRUD, export/import, version history (list/get/restore), "ask AI" per block	Save-conflict detection (no silent overwrite of concurrent edits); versions throttled ≤1/5min, capped 50/page; RAG-indexed only while topic-linked
4.4 Data model (by module)
Selected tables, grouped by owning module (not exhaustive — see module table above for the full endpoint surface):

auth: user_sessions, email_verification_tokens, password_reset_tokens
users: users (name, email, password_hash, plan, email_verified_at, profile image)
ai: chat_messages, message_feedback, documents, document_chunks (pgvector embedding column + embedding_model), message_sources
agents: agent_sessions, agent_steps
cleanup: cleanup_runs (counts-only, content-free)
coach: study_goals, study_plans, study_plan_tasks
exams: exams, exam_questions, exam_attempts, exam_answers
flashcards: flashcards (ease_factor, interval_days, status), flashcard_reviews
gamification: xp_events, user_levels, user_streaks
graph_builds: topic_build_status
growth: product_events (JSONB properties), answer_feedback, reminder_preferences, reminder_deliveries
jobs: background_jobs
knowledge_graph: concept_relations (nodes owned by mastery.concepts)
learning_style: learning_style_profile
mastery: concepts, concept_mastery, mastery_events (append-only)
memory: student_memory
mind_map: mind_maps (JSON tree)
notes: notes
quizzes: quizzes, quiz_questions, quiz_attempts, quiz_answers
study_history: study_activities
topics: topics
usage: usage_events
workspace: workspace_pages, workspace_page_versions
4.5 Background jobs
Redis-list transport (LPUSH/BRPOP) with Postgres as the durable system of record — a job row is written to Postgres before it's pushed to Redis, so admin visibility and idempotency never depend on Redis staying up. The worker loop claims a job atomically, dispatches by type, retries with exponential backoff (min(2^attempt, 30)s) up to a max, and moves exhausted jobs to a dead-letter state an admin can retry or discard. A startup/cleanup routine recovers jobs stuck running past a timeout back to queued.

Job types: document.index, note.index, workspace_page.index, memory.extract, knowledge_graph.rebuild, mind_map.rebuild, cleanup.abandoned_uploads, cleanup.expired_sessions.

Quiz/exam/flashcard generation deliberately stay synchronous, not job-queued — protected instead by Idempotency-Key support against double-submit. When REDIS_URL is unset (local dev/tests), knowledge-graph/mind-map rebuilds run inline in the same request instead of being enqueued.

4.6 Rate limiting, quotas, and cost tracking
Two independent layers:

HTTP rate limiting — a default per-IP limit plus a stricter failed-attempts-only limiter on auth endpoints (register/login/verify/reset). Redis-backed when configured (shared across replicas), else per-process memory; fails open on Redis outage.
AI usage quotas — a per-user global monthly request ceiling plus per-feature daily/monthly caps (chat, image_chat, embeddings, quiz, exam, flashcards, mind_map, knowledge_graph, workspace_ai, agents, coach), both scaled by plan feature_multiplier. Enforced before every provider call; feature is auto-inferred from the call stack so callers rarely pass it explicitly. GET /usage/me exposes used/limit/remaining and a soft-limit warning at 80% by default. Storage quota is a separate, similarly plan-scaled cap.
Every AI call is logged to usage_events with provider, model, estimated input/output tokens, latency, retries, fallback count, estimated cost USD, and outcome — the basis for the admin cost dashboards in usage/growth.

4.7 File uploads and storage
Multipart upload → magic-byte MIME sniffing (never trusts client content_type) → optional ClamAV malware scan (implemented, currently disabled in production) → a pluggable storage backend: local filesystem in dev (path-traversal-guarded) or S3-compatible in production (presigned upload/download URLs, TTL-configurable). The database stores portable object keys, never filesystem paths, so storage backends can be swapped without a migration. Abandoned uploads are swept on a schedule; document deletion is idempotent.

4.8 Security posture (notable, code-verified)
Session-based auth with fixation protection, sliding TTL, and Origin-based CSRF defense on cookie-authenticated state changes.
Anti-enumeration on forgot-password.
SSRF-hardened link-preview fetcher (DNS-resolution IP checks on every redirect hop, not just the first).
Magic-byte file-type validation instead of trusting client-supplied MIME types.
No secrets/session tokens/provider credentials in the user data export.
Admin endpoints gated by an email allow-list, not a role flag on the user record.
validate_production() refuses to boot with dev-default secrets or missing provider keys in production.
5. Frontend
5.1 Stack and conventions
Next.js 16 (via vinext) + React 19 + TypeScript, styled with Tailwind 4 layered over a hand-authored design-token system. Routes are file-based under app/<route>/page.tsx. Deployed to Cloudflare Workers. Brand name Studia; tagline "Learn smarter. Remember more." / "AI-powered study companion."

5.2 Information architecture
Primary nav (AppSidebar.tsx) — collapsible desktop sidebar / mobile drawer + bottom tab bar, in this order: Overview (/dashboard), My topics (/topics), Workspace (/workspace), Study coach (/coach), Flashcards (/flashcards), Quizzes (/quizzes), Exams (/exams), AI tutor (/ai-tutor), Study history (/study-history), Mistake notebook (/mistakes), Analytics (/analytics). Footer: theme toggle, Settings, Log out.

Hovering/focusing a nav link both prefetches the route and pre-warms its key API calls (warmApi()), so destination pages often render already-cached data.

Global command palette (Ctrl/Cmd+K) — search across topics/notes/documents/workspace pages/quizzes/exams/flashcards, plus 11 quick actions, full keyboard navigation.

Page shell pattern — every authenticated page renders through a shared PageShell: sidebar + breadcrumb + title block, with an embedded mode (?embedded=1) that strips chrome for iframe-loaded tools (this is how the Topic Detail hub loads AI tutor/quizzes/flashcards/exams/mind map/knowledge graph inside itself without double sidebars).

5.3 Design system (as it exists today)
Palette: cream/off-white page background (#f7f5f1 light), violet accent (#6d5ef6 light / #9b8fff dark), full separately-tuned dark theme (not a simple inversion).
Type: Inter for UI text, Georgia (serif) for large display headings — a deliberate sans/serif pairing; a dedicated Arabic font stack (Tahoma, "Segoe UI", Arial) for RTL/mixed-language content.
Tokens: 16px card radius, 12px control radius, an 8px spacing scale, fluid clamp()-based type scale, a 44px minimum touch target. Dark mode applied via a data-theme attribute set pre-hydration to avoid a flash, persisted to localStorage.
Primitives (components/ui/index.tsx): Card, StatCard, Badge, ActionTile, ListRow, ProgressBar, MasteryBar (color-graded low/medium/high), Button (primary/secondary/ghost/danger), EmptyState, LoadingState (skeleton + shimmer, respects prefers-reduced-motion).
Modal pattern: consistent across the whole app — backdrop, centered card, eyebrow micro-label, icon, form, Cancel + primary/danger footer action; danger variants use role="alertdialog".
App-level wrapper: ErrorBoundary (Sentry-wired) → ThemeProvider → GlobalDialogFocusTrap (app-wide focus trapping for open dialogs).
No charting/graph library is used anywhere — every bar chart, radar chart, and node graph is hand-built with DOM/CSS or raw <canvas>/SVG.
5.4 Route inventory
Route(s)	Feature
/	Public marketing landing page (hero, feature grid, "how it works", footer)
/register, /login, /forgot-password, /reset-password/[token], /verify-email/[token]	Full auth lifecycle (see §5.6)
/cookies, /privacy, /terms	Static legal pages
/dashboard	Personalized home: greeting, stat cards, "needs your attention" signals, recent topics, today's plan widget, flashcards-due widget
/topics	Topic library — search, create/edit/delete, card grid
/topic?id=	Central topic hub — 7-tool switcher grid (tutor/quizzes/flashcards/exams/mind map/knowledge graph load in an iframe; notes/documents render inline with upload, export, weak-concepts, and topic-level gamification)
/ai-tutor	AI tutor chat (3 modes — see §5.7)
/workspace, /workspace-page	Notion-style block editor (see §5.7)
/coach	Study coach — today's plan, exam dates/study-time settings, exam-readiness forecast
/flashcards, /flashcards/deck, /flashcards/review	Flashcard decks, AI generation, CSV import/export, review loop (I forgot/Hard/Medium/Easy)
/quizzes, /quizzes/topic, /quizzes/take, /quizzes/results, /quizzes/review	Casual quiz generation (5 source scopes, 6 question types, adaptive difficulty option), taking, results with AI diagnosis, draft review before publish
/exams, /exams/topic, /exams/take, /exams/results, /exams/review	Formal timed exams, Bloom's-taxonomy scoring, rubric-graded free response, draft review before publish
/mistakes	Wrong-answer notebook with "ask tutor" / "make flashcard" / "try similar" actions
/weekly-report	7-day stats, activity chart, recommended-next callout
/study-history	Day-grouped activity timeline, filters, PDF export
/knowledge-graph	Interactive force-directed canvas graph, mastery-colored, click-to-inspect side panel
/mind-map	Generated left-to-right tree diagram (canvas)
/analytics	Cross-topic KPIs, per-topic mastery/XP table, 7-day activity chart, weakest concepts
/admin	Admin-only usage/cost/retention dashboards (read-only)
/settings	Profile, reminders, dark mode, learning-style radar chart, password/session management, storage usage, data export, account deletion
5.5 Key interactive features (design-relevant detail)
AI Tutor chat — request/response (no streaming). Tutor mode is topic-grounded RAG Q&A with /-triggered document scoping, image attachment, quick-prompt chips, thumbs up/down rating, clickable source citations, and a "shaped by memory" badge. Sparring mode: the AI argues a deliberately wrong claim; the user must correct it across turns to a "concede" verdict with a trophy card. Agent mode: free-form requests routed to specialist agents, with an expandable step-trace panel.
Workspace block editor — 18 block types (text, headings, lists, to-do, toggle, quote, callout, code, divider, equation, image, video, bookmark, nested page). Slash-command insert, drag-handle reorder/nest, right-click context menu (turn into / color / duplicate / move / Ask AI / delete), an in-editor "Ask AI" popover (insert-below/replace/discard), autosave with conflict detection, and version history with restore.
Knowledge graph — genuine force-directed physics simulation on <canvas>; drag/pan/zoom; nodes sized by importance, colored red→green by mastery; click opens a detail panel with a mastery-history timeline and "why this score?" event log.
Mind map — generated horizontal tree diagram, scrollable, non-interactive (pure visual outline).
Gamification — shared XP toast (confetti "Level up!" / "+N XP") triggered by sparring wins, flashcard reviews, and quiz answers; per-topic level card; streak tracking on dashboard and analytics.
5.6 Auth flow
Register → (best-effort) verification email → Login ⇄ Forgot/Reset password, on one shared visual template (decorative left panel + form right panel). Registration does not block login on verification — an unverified user gets a dismissible nudge in Settings with a resend action, rather than a hard gate. Forgot-password always shows the same success state regardless of whether the email exists. Reset requires the new password twice (8-char minimum) and auto-redirects to login on success. Logout is a POST /auth/logout that clears the session cookie. Settings additionally exposes multi-session visibility and revocation.

5.7 Frontend ↔ backend integration
Single client module app/lib/api.ts. All calls go to the frontend's own origin at /api/v1/*, which next.config.ts rewrites server-side to the real backend (keeps the session cookie first-party — see §3). Cookie-session auth (credentials: "include"), no client-stored token. A generic api<T>() wrapper throws a typed ApiError and attaches a per-request X-Request-Id for cross-system log correlation. Successful GETs on a curated allowlist are deduplicated and cached (in-memory + sessionStorage, per-path TTL); any mutation invalidates the cache generation. Expensive AI-generation calls carry an idempotency-key header to prevent duplicate paid calls on double-click/retry. Uploads use raw XMLHttpRequest for progress events; downloads use blob + synthetic anchor click.

5.8 Known inconsistencies (worth resolving before a redesign)
app/components/StudyPages.tsx is dead code — an unused legacy prototype built on hardcoded fake data, not the live implementation of any current page.
globals.css contains an unused "AI Memory" settings-panel style block with no corresponding live component — either a removed feature or one that was designed but never wired up. Confirm with engineering before treating it as a real settings surface.
docs/architecture/architecture.json (auto-generated) is stale — it describes JWT auth (incorrect) and only 8 of the 29 backend modules. Do not use it as a source of truth; this document supersedes it.
6. Setup reference
Backend: Python ≥ 3.11, PostgreSQL with pgvector enabled, Redis (optional but recommended), an S3-compatible bucket for production storage, at least one of OpenAI/Gemini/Groq API keys, SMTP credentials for email. Migrations via Alembic (migrations/versions/). Config entirely via environment variables (pydantic-settings, .env.example provided).
Frontend: Node.js ≥ 22.13.0. npm run dev (via vinext), npm run build, npm run lint, npm run test:e2e (Playwright). Deploys via wrangler to Cloudflare Workers; BACKEND_INTERNAL_URL must point at the deployed backend for the rewrite proxy to work.
Compiled from a direct code audit of backend/app/** and frontend/app/**. Endpoint counts, model names, and business-logic descriptions reflect the code as of 2026-08-12, not the planning checklist in SAAS_TODO.md.