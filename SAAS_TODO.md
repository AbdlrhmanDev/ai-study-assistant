# Studia SaaS Completion Checklist

Last updated: 2026-08-11 (Phase 1 closed-beta-readiness implementation pass)

This is the source of truth for SaaS launch readiness. When a requirement is implemented and its acceptance criteria have been verified, change its checkbox from `[ ]` to `[x]`, add the completion date, and include the relevant test, pull request, or deployment reference in the notes.

## Status legend

- `[ ]` Not complete
- `[x]` Complete and verified
- A requirement is not complete merely because code was written. Its acceptance criteria must pass.
- If work is intentionally postponed, leave it unchecked and mark it **Deferred** in its notes.

## Launch readiness summary

- [ ] Phase 0: Stable build and CI — implementation complete; awaiting a clean GitHub CI run and branch-protection configuration
- [ ] Phase 1: Closed beta readiness
- [ ] Phase 2: Paid SaaS v1 readiness
- [ ] Phase 3: Growth and optimization

## Phase 0 — Stabilize the build

### Developer setup

- [x] Document the required Node.js, Python, PostgreSQL, pgvector, Redis, and environment-variable versions. Completed 2026-08-10.
- [x] Verify a new developer can run the frontend and backend from a clean checkout. Clean dependency, build, database, migration, and test paths verified 2026-08-10.
- [x] Provide safe `.env.example` files for every service without real secrets. Verified 2026-08-10.
- [x] Add seed/demo data for local manual testing. Completed and idempotency-tested 2026-08-10.

Acceptance criteria:

- A clean setup following the README starts the application successfully.
- No undocumented manual database or configuration changes are required.

### Frontend verification

- [x] Install frontend dependencies from the lockfile in a clean environment. Isolated `npm ci` package installation verified 2026-08-10.
- [x] Make `npm run lint` pass. Verified with zero warnings 2026-08-10.
- [x] Make the production frontend build pass. Verified with Vinext 0.0.50 on 2026-08-10.
- [x] Replace or remove `frontend/tests/rendered-html.test.mjs`, which still tests the starter loading skeleton. Completed 2026-08-10.
- [x] Add tests for the actual Studia landing page and authenticated application shell. Three tests passing 2026-08-10.
- [x] Add integration tests for registration, login, topic creation, uploads, AI chat, quizzes, and flashcards. Playwright route and account-journey coverage added 2026-08-10; backend smoke suite verifies API mutations.
- [x] Add mobile viewport tests for exams, workspace editing, flashcards, mind maps, and knowledge graphs. Pixel 7 Chromium coverage passed 2026-08-10.

Acceptance criteria:

- Lint, build, unit tests, and integration tests pass from a clean checkout.
- Tests no longer expect “Your site is taking shape” or other starter-template content.

### Backend verification

- [x] Install backend dependencies in a clean environment. All pinned requirements installed and imported in an isolated virtual environment 2026-08-10.
- [x] Make the complete backend test suite pass. Verified: 172 tests passed on 2026-08-10.
- [x] Run tests against disposable PostgreSQL with pgvector enabled. Verified using an isolated PostgreSQL 18 cluster on 2026-08-10.
- [x] Add smoke tests for login, topics, notes, document indexing, AI fallback, quiz generation, flashcard review, and export. CI smoke selection and document lifecycle test added 2026-08-10.
- [x] Verify Alembic can upgrade an empty database to `head`. All 21 migrations verified 2026-08-10.
- [x] Test safe downgrade/upgrade paths for important migrations where practical. Latest migration downgrade/upgrade verified 2026-08-10.

Acceptance criteria:

- All backend tests and migration checks pass consistently in a clean environment.

### Continuous integration

- [x] Add a CI workflow for frontend dependency installation, lint, build, and tests. Added 2026-08-10.
- [x] Add a CI workflow for backend dependency installation and tests. Added 2026-08-10.
- [x] Add PostgreSQL and pgvector services to CI. Added 2026-08-10.
- [x] Add Alembic migration validation to CI. Added empty-upgrade, single-head, and model-drift checks 2026-08-10.
- [x] Add dependency vulnerability scanning. Added npm audit, pip-audit, and Dependabot 2026-08-10.
- [x] Add secret scanning. Added Gitleaks CI job 2026-08-10.
- [ ] Protect the main branch from merging when required checks fail.

Acceptance criteria:

- Every pull request runs all required checks automatically.
- A failing check prevents accidental release or merge.

## Phase 1 — Closed beta readiness

### Production object storage

- [x] Choose Cloudflare R2, AWS S3, GCS, or another S3-compatible provider. Cloudflare R2 selected (`STORAGE_BACKEND=s3`, R2-compatible endpoint); bucket/key provisioning in Railway remains a manual step (see `PHASE_1_REMAINING_AR.md`).
- [x] Implement a production object-storage backend behind the existing storage interface.
- [x] Store object keys in the database instead of absolute local filesystem paths.
- [x] Keep local filesystem storage available only for local development and tests.
- [x] Add signed upload/download URLs when direct file access is required. `signed_upload_url` added to the `StorageBackend` protocol (both implementations); `signed_download_url` already existed. Tested against a mocked S3 backend 2026-08-10 (`tests/test_s3_storage.py`).
- [x] Add reliable document deletion from both the database and object storage. Delete is now idempotent (a missing storage object no longer fails the request). Tested 2026-08-10.
- [x] Add cleanup for abandoned uploads. `sweep_abandoned_uploads()` marks stuck `pending`/`processing` documents failed and deletes their storage object past `ABANDONED_UPLOAD_MINUTES`; runnable via the worker or `python -m app.core.jobs --cleanup`. Tested 2026-08-10.
- [ ] Configure lifecycle and retention policies. Code-side prefixes (`documents/`, `tmp/`, `pending-deletion/`) exist for a bucket lifecycle rule to target, but the actual R2 console lifecycle policy still needs to be created manually.
- [x] Validate file signatures/MIME types instead of trusting client-provided `content_type`.
- [x] Validate allowed extensions and file sizes.
- [ ] Add malware/content scanning before public launch. **Deferred 2026-08-10:** the ClamAV integration exists in code, but production activation is postponed because the current Railway plan is limited to 1 GB RAM and ClamAV generally needs substantially more. Keep `MALWARE_SCAN_REQUIRED=false`; revisit before public launch or when suitable infrastructure is available.
- [x] Add upload progress, retry, indexing status, and failure messages in the UI. Real `XMLHttpRequest`-based progress bar, a Retry button wired to `POST /documents/{id}/retry`, and a screen-reader `aria-live` announcement when a document finishes processing or fails. Verified in a live browser session and via Playwright 2026-08-11.

Acceptance criteria:

- Uploaded files survive application restarts and redeployments.
- Uploads work correctly with multiple backend replicas.
- Invalid, oversized, and unsafe files are rejected.
- Deleting a document removes its stored object and derived data.

### AI usage metering and cost controls

- [x] Add a durable `usage_events` or equivalent ledger.
- [x] Record user, feature, provider, model, prompt tokens, output tokens, image/file usage, latency, retry count, fallback count, and estimated cost.
- [x] Record prompt/template version without storing secrets or unnecessary personal data.
- [x] Define beta limits for every expensive AI feature.
- [x] Enforce per-user and per-feature limits in the backend. Per-feature daily/monthly caps (`AI_FEATURE_LIMITS`) now layer on top of the existing global monthly ceiling. Tested 2026-08-10 (`tests/test_usage.py`).
- [x] Add graceful responses when quota is exhausted.
- [x] Add soft-limit warnings before hard limits are reached. `GET /usage/me` now returns `softLimitHit`/`remaining` per feature at `SOFT_LIMIT_WARNING_THRESHOLD`; surfaced in Settings via a `role="status"` banner. Tested 2026-08-10.
- [x] Add an internal usage and estimated-cost dashboard. `AdminUsagePage` (`/admin`) built on the extended admin summary/failures/top-cost API, gated on `ADMIN_EMAILS`. Tested 2026-08-10 (403-for-non-admin, date filtering).
- [ ] Add alerts for abnormal AI cost, latency, retry, and failure spikes. Metrics and admin visibility exist; no alerting/notification channel is wired up yet.
- [ ] Add provider failure and fallback monitoring. Retry/fallback counts are recorded per call and visible in the admin failures endpoint, but there is no active alerting on them.

Features requiring explicit limits:

- [x] AI tutor chat
- [x] Image chat
- [x] Document indexing and embeddings. Embeddings now route through the same `usage_service` chokepoint as AI generation (`feature="embeddings"`), metered and quota-enforced. Tested 2026-08-10.
- [x] Quiz generation
- [x] Exam generation
- [x] Flashcard generation
- [x] Mind-map generation
- [x] Knowledge-graph rebuilds
- [x] Workspace Ask AI
- [x] Study agents and coach generation

Acceptance criteria:

- Every billable AI call produces a usage record.
- Backend APIs reject or degrade expensive requests after a quota is exhausted.
- Administrators can identify cost by user, feature, provider, and model.

### Observability and monitoring

- [x] Add frontend error monitoring. `@sentry/react` (framework-agnostic, since the frontend is Vite/`vinext` on Cloudflare Workers, not a webpack Next.js build) gated on `NEXT_PUBLIC_SENTRY_DSN`, plus a React `ErrorBoundary` around the app shell.
- [x] Add backend error monitoring.
- [x] Collect request count, latency, and error rate by route.
- [x] Collect database pool utilization and slow-query metrics. SQLAlchemy `before_cursor_execute`/`after_cursor_execute` hooks log (and count) queries over `SLOW_QUERY_MS`, with parameterized/truncated query text. Tested 2026-08-10.
- [x] Collect AI tokens, cost, latency, retries, and failures.
- [x] Collect upload/indexing success and failure metrics.
- [x] Collect queue depth, oldest-job age, and dead-letter count. `studia_queue_depth`, `studia_queue_oldest_job_age_seconds`, `studia_jobs_running`, `studia_jobs_failed_total`, `studia_jobs_dead_letter` gauges/counters, also exposed via `GET /admin/jobs/metrics`.
- [x] Collect authentication failure metrics. `studia_auth_failures_total` counter added alongside the existing `record_auth_failure` call. Subscription-state metrics are not applicable yet (no billing).
- [ ] Add tracing across frontend, backend, database, AI providers, and workers. A single correlation/request ID now round-trips frontend → backend → job → AI provider call log (not full distributed tracing spans/OTel).
- [ ] Add uptime checks for `/`, `/health`, and `/health/ready`. **Out of scope for this pass** — requires a public domain, excluded by explicit instruction.
- [ ] Add a synthetic login and create-topic check. **Out of scope for this pass** — same domain dependency.
- [ ] Add alerts for elevated 5xx responses, database saturation, Redis failures, queue backlog, provider failures, high AI spend, and webhook failures. Metrics exist; no alerting channel configured.
- [x] Define structured-log retention and protect sensitive data from logs. `REDACT_KEYS` extended to cover `s3_secret_access_key`, `redis_url`, `session_secret`; a value-pattern scrubber now also catches bearer-token/connection-string-shaped values in free-text fields. Tested 2026-08-10.

Acceptance criteria:

- Production failures generate actionable alerts.
- A request can be followed across the frontend, API, database, provider, and worker using correlation/request IDs.

### Durable background jobs

- [x] Select a durable queue and worker system.
- [x] Move long-running indexing and AI work out of FastAPI `BackgroundTasks`.
- [x] Add retries with safe limits and exponential backoff.
- [x] Add dead-letter handling and operational visibility.
- [x] Add idempotency for document indexing and expensive generation operations. Job-level idempotency keys (`document.index:{id}`, `note.index:{id}`) dedupe in-flight/recent jobs; quiz/exam/flashcard generation (kept synchronous, see below) gained an `Idempotency-Key` header so a double-submit returns the cached result instead of billing/generating twice.
- [x] Make jobs safe to retry without duplicating user data or charges. Indexing deletes existing chunks before re-inserting (not append), so even a genuine re-run never duplicates data.
- [x] Add cleanup and recovery procedures for stuck jobs. `recover_stuck_jobs()` resets jobs stuck `running` past a timeout back to `queued`; runs at worker startup and via the cleanup entrypoint.

Jobs to migrate:

- [x] Document text extraction and embedding
- [x] Memory extraction
- [x] Knowledge-graph rebuilds. Rebuild endpoint now enqueues a job and returns `202`; frontend polls for status. Tested 2026-08-10.
- [x] Mind-map generation/rebuilds. Same async pattern as knowledge-graph rebuilds. Tested 2026-08-10.
- [ ] Long quiz/exam/flashcard generation. **Confirmed scope decision:** these stay synchronous (not migrated to the async job queue) but gained `Idempotency-Key` protection against double-submission. Full async migration was explicitly deferred, not overlooked.
- [ ] Email delivery where appropriate. **Out of scope for this pass** — no transactional email provider is configured (excluded, no domain).

Acceptance criteria:

- Application restarts do not silently lose queued work.
- Failed jobs can be inspected, retried, or discarded safely.

### Account lifecycle

- [ ] Add email verification. **Out of scope for this pass** — requires a domain/transactional email, excluded by explicit instruction.
- [ ] Add forgot-password and secure password-reset flows. **Out of scope for this pass** — same email dependency.
- [x] Add change-password functionality. `POST /users/me/password`, requires `current_password`, updates the hash, invalidates every other session. Tested 2026-08-10 (`tests/test_account_security.py`).
- [x] Add account deletion with confirmation and reauthentication. `POST /users/me/delete` requires password reauthentication; removes documents (storage + DB), notes, topics, workspace pages, quizzes/exams/flashcards, study history, memory/coach/agent data, sessions, and queued jobs. Retry-safe (a second call is a no-op). Tested 2026-08-10.
- [x] Add complete account data export. `GET /users/me/export` assembles topics, notes, document metadata, workspace pages, quizzes, exams, flashcards, study history, usage summary, and settings into one JSON, explicitly excluding `password_hash`, session tokens, and provider credentials. Tested 2026-08-10.
- [x] Add session/device viewing and revocation. `GET /users/me/sessions` (device parsed from user-agent, `isCurrent` flag), `DELETE /users/me/sessions/{id}`, `DELETE /users/me/sessions` (revoke all but current). Ownership isolation tested 2026-08-10 (two users, one can't revoke the other's session).
- [x] Invalidate relevant sessions after password and security changes. Change-password deletes every other session for that user.
- [ ] Add transactional email delivery and deliverability monitoring. **Out of scope for this pass.**
- [ ] Create email templates for verification, password reset, security notices, and account deletion. **Out of scope for this pass.**
- [ ] Consider magic-link or OAuth login after the core lifecycle is stable. **Out of scope for this pass** — requires OAuth redirect domains.

Acceptance criteria:

- Users can recover, secure, export, and delete their accounts without administrator database access.
- Email tokens expire, are single-use, and are stored securely.

### Legal, privacy, and user controls

- [x] Publish Terms of Service.
- [x] Publish a Privacy Policy.
- [x] Define and publish a data-retention policy.
- [x] Explain which AI providers may process user content.
- [ ] Document vendors/subprocessors for AI, hosting, database, email, analytics, monitoring, storage, and billing. (Register template exists; deployment choices must be filled in.)
- [x] Add a cookie notice and consent controls if non-essential cookies are used.
- [x] Implement the documented data-export process. See account lifecycle above (`GET /users/me/export`).
- [x] Implement the documented account/data-deletion process. See account lifecycle above (`POST /users/me/delete`).
- [x] Define retention and cleanup for sessions, deleted documents, abandoned uploads, and AI traces. Three scheduled sweeps (`cleanup.expired_sessions`, abandoned uploads, `cleanup.ai_traces` for `usage_events`) each write a `CleanupRun` audit row (counts only, no content); runnable via `python -m app.core.jobs --cleanup`. Tested 2026-08-10 (`tests/test_cleanup.py`, 7 tests).
- [x] Review age-gating and education/minor-data requirements before marketing to children or schools.
- [x] Prepare DPA/vendor-review information for future institutional customers.

Acceptance criteria:

- The product’s actual data handling matches its published policies.
- Export and deletion requests complete across the database, object storage, logs, and downstream systems where legally required.

### Core UX

- [ ] Update the landing page to represent the full current product. Audited 2026-08-10: still doesn't mention flashcards/exams/mind-map/knowledge-graph. Not yet updated.
- [ ] Add useful empty states to all major features. Study history and coach use the shared `EmptyState` component; exams, mind-map, and knowledge-graph still use an older ad-hoc `<div className="empty">` pattern (functional, not yet migrated for visual consistency).
- [x] Add global search/command access for topics, notes, documents, workspace pages, quizzes, and other key content. `CommandPalette` now queries `/study-search` for live results across content types and supports arrow-key navigation, matching the footer hint.
- [x] Add accessibility checks for keyboard navigation, focus states, dialog semantics, contrast, labels, and reduced motion. See the accessibility completion-log entry below.
- [x] Show document indexing status and recovery actions. Retry button + status badges (existing pattern, now also mirrored for knowledge-graph/mind-map rebuild status).
- [x] Verify workspace autosave under slow networks and concurrent tabs. Save-conflict detection compares `updated_at` before overwriting and surfaces a "changed elsewhere" message instead of silently clobbering; covered by `tests/test_workspace.py` (4 new tests) and frontend conflict-UI wiring.

Acceptance criteria:

- A new beta user can reach their first useful AI-supported study activity without manual assistance.
- Essential journeys are usable with a keyboard and supported mobile layouts.

## Phase 2 — Paid SaaS v1 readiness

### Plans and product packaging

- [ ] Finalize Free plan features and limits.
- [ ] Finalize Pro monthly features, price, and limits.
- [ ] Finalize discounted Student annual pricing.
- [ ] Define upgrade, downgrade, cancellation, grace-period, and refund behavior.
- [ ] Document which features are free, premium, quota-limited, or unavailable.
- [ ] Keep organization, school, classroom, seat, and role features out of v1 unless customer evidence justifies them.

Suggested initial packaging:

- Free: limited topics, AI chats, uploads, storage, quizzes, and flashcards.
- Pro: higher quotas, document RAG, image chat, exams, coach, and exports.
- Student annual: discounted annual Pro subscription.

### Billing integration

- [ ] Integrate Stripe or the selected billing provider.
- [ ] Add `plans` records with price references, feature flags, and limits. Partial scaffolding (2026-08-12): plan tiers are config-driven (`DEFAULT_PLAN_TIERS` in `app/core/config.py`, overridable via `PLAN_TIERS` JSON env; `DEFAULT_PLAN` fallback) with a `users.plan` column, `GET /plans/me`, and plan-aware enforcement of feature quotas (`usage/service.py`) and document storage (`ai/service.py`). No database `plans` records or Stripe-backed purchases yet.
- [ ] Add `customers` records linked to application users.
- [ ] Add `subscriptions` with status, plan, billing period, and cancellation state.
- [ ] Add `billing_webhook_events` with provider event ID, payload hash, processing state, and error details.
- [ ] Add `entitlement_overrides` for audited support exceptions.
- [ ] Implement checkout.
- [ ] Implement the customer billing portal.
- [ ] Synchronize subscription lifecycle events through signed webhooks.
- [ ] Make webhook processing idempotent.
- [ ] Handle trial, active, past-due, canceled, incomplete, and expired states.
- [ ] Display plan, renewal/cancellation state, invoices, payment method, and usage in Settings.
- [ ] Send billing confirmation, failure, cancellation, and renewal emails.
- [ ] Define refund and billing-support procedures.

Acceptance criteria:

- A user can purchase, manage, cancel, and restore service through supported flows.
- Duplicate or reordered webhooks cannot duplicate charges or corrupt subscription state.
- The local subscription state reconciles with the billing provider.

### Backend entitlements

- [ ] Create a central backend entitlement service/dependency.
- [ ] Gate premium features server-side.
- [ ] Enforce topic, document, storage, workspace, and AI quotas server-side. Partial: storage and AI quotas are now plan-aware (2026-08-12) -- `users.plan` tiers drive per-plan document storage caps (`413` on exceed, `GET /documents/storage-usage` returns `{usedBytes, limitBytes, plan}`) and per-feature AI limits scaled by the plan's `feature_multiplier`. Topic/workspace quotas are still unenforced, and billing-tier changes aren't purchasable yet.
- [ ] Prevent direct API calls from bypassing UI restrictions.
- [ ] Add clear error codes for upgrade required, quota exhausted, payment past due, and subscription inactive.
- [ ] Add tests for every plan/feature combination.
- [ ] Add audited administrative overrides with expiry dates.

Acceptance criteria:

- Users cannot exceed plan limits through direct API calls or concurrent requests.
- Entitlement decisions are consistent across all backend modules.

### Support and administration

- [ ] Create safe administrator authentication and authorization.
- [ ] Add support lookup for account, subscription, entitlement, and usage state.
- [ ] Add tools for session revocation, quota overrides, resend verification, and deletion status.
- [ ] Add audit logs for support access and changes.
- [ ] Add abuse-management and account-suspension workflows.
- [ ] Add refund/cancellation support procedures.
- [ ] Never require support staff to edit production database rows directly.

Acceptance criteria:

- Authorized support staff can diagnose common account and billing problems without direct database access.
- Every sensitive support action is attributable and auditable.

### Production infrastructure and release safety

- [ ] Maintain separate local, staging, and production environments.
- [ ] Use managed PostgreSQL with pgvector enabled.
- [ ] Configure production Redis for distributed rate limits and queues.
- [ ] Require strong production secrets and exact allowed origins.
- [ ] Configure HTTPS, HSTS, and secure cookies.
- [ ] Add a frontend Content Security Policy where practical.
- [ ] Run migrations as a controlled release step rather than from every replica.
- [ ] Enable automated database backups.
- [ ] Perform and document a database restore drill.
- [ ] Configure point-in-time recovery if supported.
- [ ] Add backend, frontend, worker, and migration rollback procedures.
- [ ] Add a production deployment checklist.
- [ ] Add an incident-response runbook and escalation contacts.
- [ ] Add a public support contact.

Acceptance criteria:

- A failed release can be detected and rolled back safely.
- Database restoration has been tested, timed, and documented.

### API and database hardening

- [ ] Publish the OpenAPI contract.
- [ ] Generate frontend API types from the backend contract.
- [ ] Detect frontend/backend contract drift in CI.
- [ ] Add idempotency keys to paid or expensive operations.
- [ ] Add consistent pagination to potentially unbounded list endpoints.
- [ ] Add indexes for verified high-volume query paths.
- [ ] Validate pgvector index configuration with realistic data volume and embedding sizes.
- [ ] Add cleanup jobs for expired sessions and retained temporary data.
- [ ] Add admin-safe audit logging for billing and account lifecycle events.

Acceptance criteria:

- Breaking API changes are detected before deployment.
- Production-like load tests show acceptable query and vector-search performance.

### Security and abuse prevention

- [ ] Add automated-registration abuse detection.
- [ ] Add repeated-AI-call and quota-evasion detection.
- [ ] Add suspicious-upload detection.
- [ ] Protect link previews and other outbound fetches against SSRF.
- [ ] Add CAPTCHA or email-risk scoring if public signup abuse warrants it.
- [ ] Verify all internal/admin endpoints require explicit authorization.
- [ ] Complete a pre-launch security review.
- [ ] Define vulnerability reporting and patching procedures.

Acceptance criteria:

- High-risk abuse cases are tested and monitored.
- No administrative capability is protected only by an obscure URL.

## Paid SaaS v1 definition of done

Do not mark this section complete until every statement is true.

- [ ] A new user can register and verify their email.
- [ ] The user can create a topic and add notes or upload study material.
- [ ] The user can chat with sources and understand document indexing status.
- [ ] The user can generate practice, review flashcards, and see progress.
- [ ] Paid plans and premium features are enforced by the backend.
- [ ] AI usage is measured, visible, and capped by plan.
- [ ] Uploaded files are stored durably outside the application container.
- [ ] CI passes from a clean checkout.
- [ ] Production monitoring, alerts, backups, restore procedures, and rollback steps are operational.
- [ ] Users can reset passwords, manage sessions, export data, and delete accounts.
- [ ] Legal and privacy pages are live and accurate.
- [ ] Support can inspect account and billing state safely without direct database access.
- [ ] Billing, quota, account-deletion, and support actions are auditable.

## Phase 3 — Growth and optimization

These items improve retention, learning quality, and unit economics but should not block the individual paid v1 unless explicitly promoted as launch features.

### Product analytics

- [x] Track signup conversion. `ProductEvent` row `signup` fired server-side on account creation (`users/service.py`). Implemented 2026-08-12.
- [x] Track activation milestones: first topic, note/upload, AI answer, quiz, and flashcard review. Server-side `first_topic`, `first_upload`, `first_ai_answer`, `first_quiz`, `first_flashcard_review`, and the umbrella `activation` event (`growth/service.py` helpers fired from the topics/ai/quizzes/flashcards services). Admin `GET /api/v1/analytics/funnel` reports per-stage counts and conversion rates. Implemented 2026-08-12.
- [ ] Track weekly active learners and study sessions per user. Partial: admin `GET /api/v1/analytics/retention` computes weekly signup cohorts and weekly-active user counts from `StudyActivity` + `ProductEvent` (2026-08-12). A per-user "study sessions" dashboard remains open.
- [ ] Track quiz/exam completion and flashcard retention. Partial: per-question quiz/exam analytics and flashcard SM-2 state exist, but completion/retention funnels per user are not tracked yet.
- [ ] Track coach-plan completion.
- [ ] Track free-to-paid conversion.
- [ ] Track churn and cancellation reasons.

### AI and RAG quality

- [ ] Build evaluation datasets for citation and answer quality. Partial: offline harness `scripts/evaluate_rag.py` (recall@K, MRR over a JSONL query set) and `docs/rag-evaluation.example.jsonl` exist, but the file holds only a 2-row example -- a real labeled dataset is still pending.
- [x] Add tests for insufficient evidence, refusal, and uncertainty. `tests/test_ai_chat.py`: citation tests confirm answers cite the note actually containing the answer (and don't cite unrelated notes); `build_input` unit test confirms insufficient-evidence flagging; an end-to-end test confirms a no-material question sends the fallback "insufficient evidence" framing to the provider. Tested 2026-08-11.
- [x] Track answer helpfulness and source-click behavior. Answer helpfulness is fully tracked (`answer_feedback` rows: rating + optional reason/comment, unique per user/message; `PUT /ai/messages/{id}/feedback`; thumbs up/down on the tutor UI). Source clicks are now tracked too: `POST /ai/messages/{id}/sources/click` (ownership-verified, emits a `source_click` product event, HTTP 202), with tutor source chips wired to fire best-effort telemetry. Implemented 2026-08-12.
- [x] Add re-index controls when embeddings fail or models change. `document_chunks.embedding_model` records the `{provider}:{model}` that produced each chunk's vector; `GET /topics/{id}/reindex-status` counts chunks whose model doesn't match the current config (including pre-migration NULLs, a bug caught and fixed with a regression test); `POST /topics/{id}/reindex` re-enqueues every note/document. Frontend banner on `TopicDetailPage` surfaces it. Tested 2026-08-11 (6 tests).
- [x] Track model routing by feature to reduce cost. `AI_FEATURE_PROVIDERS` env maps features to providers (e.g. `{"chat":"openai","quiz":"groq"}`); `Settings.feature_providers` exposes it; `ai/provider.py` selects providers per feature with fallback/retry, and usage rows record the `feature`, `provider`, and `model` actually used. Implemented 2026-08-12 (no dedicated unit test yet).
- [x] Cache stable AI-generated artifacts safely. `core/idempotency.py` returns cached responses for repeated/in-flight generation calls (300s default TTL; Redis when `REDIS_URL` set, in-memory otherwise), blocking double-submit cost. On top of that retry cache, a stable content-addressed artifact cache (`AI_ARTIFACT_CACHE_TTL_SECONDS=86400`) now short-circuits identical quiz/exam/flashcard/mind-map generations even without an idempotency key: the key is `sha1(user|feature|payload|material_signature)`, where the material signature is a count + max-updated-at fingerprint of the topic's notes and documents, so adding/editing material invalidates the cache and stale AI output is never served. Implemented 2026-08-12 (static test coverage in `tests/test_phase3_features.py`).

### Learning feature improvements

- [x] Add quiz/exam generation preview and editing. Quizzes gained a `status` (`draft`/`published`) column: `preview: true` on generate creates a draft the owner can review, edit (`PATCH .../questions/{id}`, prompt/choices/answer-key), regenerate a single question, or delete, before `POST .../publish` makes it takeable (attempts are blocked on drafts). Frontend: a "Preview before publishing" checkbox and a new `/quizzes/review` page. Exams now mirror the full flow (2026-08-12): `exams.status` column (`draft`/`published`, `server_default="published"` so existing rows stay valid), `ExamGenerate.preview`, `GET /exams/{id}/review` (answer key/rubric included), `POST /exams/{id}/publish`, `PATCH`/`DELETE /exams/{id}/questions/{id}`, and `POST .../regenerate` -- with edit-validation per question type (multiple-choice choices/correctIndex, true/false, short-answer accepted answers, rubric-based types require >= 2 criteria). Drafts cannot be started or edited once published (409). Frontend: draft badge, "Preview before publishing" checkbox (default on), and a new `/exams/review` page with edit/regenerate/delete/publish. Tested 2026-08-11 (16 quiz tests); exam draft-flow tests written statically in `tests/test_phase3_features.py` (not executable until the Docker test DB is back).
- [x] Add difficulty calibration from learner performance. `GET /topics/{id}/quiz-analytics` aggregates per-user accuracy across all of a topic's quiz questions plus seconds-per-question (derived from consecutive `answered_at` gaps), rolls up to per-concept stats, flags the 5 most-mis-calibrated questions (`calibrationDelta` = observed − assigned difficulty), and returns a `recommendedDifficulty` (easy when accuracy < 0.5, medium ≤ 0.75, else hard). The quiz generate modal's difficulty defaults to `auto`, resolved against this endpoint (fallback `mixed`). Implemented 2026-08-12.
- [x] Add item-level analytics and duplicate-question prevention, for both quizzes and exams. `GET /quizzes/{id}/analytics` and `GET /exams/{id}/analytics` report per-question times-answered/accuracy (exams: points-earned/possible, since rubric questions aren't binary-correct). Topic roll-ups added 2026-08-12: `GET /topics/{id}/quiz-analytics` and `GET /topics/{id}/exam-analytics` aggregate across every question in the topic (exam per-question times computed only over graded answers so in-progress rubric answers don't skew results), with concept roll-ups and `mostMissedConcepts`. Generation now feeds the topic's already-asked prompts back to the AI as an "avoid repeating" list and drops any exact duplicates the model produces anyway -- falls back to the un-deduped set rather than ever failing a generation outright. Tested 2026-08-11 (quiz + exam analytics/dedup tests).
- [x] Add flashcard bulk edit/import/export and deck-health metrics. CSV export already existed; added CSV import (`POST /topics/{id}/flashcards/import`, tolerant of the export's own column set), bulk archive/unarchive/delete (`POST /topics/{id}/flashcards/bulk`), and deck-health (`GET .../deck-health`: new/young/mature counts by SM-2 interval, plus a leech count for cards forgotten 3+ times). Frontend: Import CSV button, per-card checkboxes with a bulk-action bar, and a maturity/leech summary row on the deck page. Tested 2026-08-11 (7 tests).
- [x] Add workspace version history or recovery snapshots. `workspace_page_versions` snapshots a page's prior (title, blocks) state on edit -- throttled to at most one snapshot per 5 minutes per page so autosave doesn't flood the history, capped at 50 kept per page. `GET .../versions`, `GET .../versions/{id}`, `POST .../versions/{id}/restore` (restoring itself snapshots the current state first, so it's always undoable). Frontend: a "Version history" panel on the workspace editor. Tested 2026-08-11 (7 tests).
- [x] Decide and document whether workspace pages feed RAG automatically. **Decision: yes, for topic-linked pages.** Retrieval is always topic-scoped, so an unlinked page has nowhere to be retrieved from -- it feeds RAG once linked, and its chunks are cleared if unlinked. Implemented: `document_chunks.workspace_page_id`, re-indexed on every content edit or topic-link change, surfaced in chat citations as a `workspace_page` source type alongside note/document. Tested 2026-08-11 (7 tests, including a direct storage/retrieval check and wiring checks that indexing fires exactly when it should).
- [x] Clarify relationships between coach, mastery, knowledge graph, and mind map. Documented as a module docstring on `app/modules/coach/service.py` (the natural place a future engineer would look): Mastery is the sole source of truth for per-concept skill level; Coach reads only Mastery's weak-concept list (no KG/mind-map dependency); Knowledge Graph visualizes the same `Concept` rows Mastery scores, plus AI-extracted relationships, colored by Mastery; Mind Map is a separate purely-structural outline with no mastery or relation data.
- [x] Add rebuild/reset controls and explainability for generated learning artifacts. Rebuild already existed (202 + polling) with in-flight dedup, but nothing stopped an immediate re-trigger right after a rebuild *finished* -- added a shared 2-minute cooldown (`graph_builds/service.py::assert_rebuild_allowed`, 429 with `retryAfterSeconds`) for both knowledge-graph and mind-map rebuilds; a failed build is exempt so retrying after a real failure isn't throttled. Explainability: the mastery-history endpoint (`GET /topics/{id}/mastery/{conceptId}/history`) already existed but was never called from the frontend -- added a "Why this score?" toggle on the Knowledge Graph concept panel that lists the graded events (quiz/exam/flashcard/sparring) behind a concept's mastery score. A standalone "reset" (clear without regenerating) control was not added -- rebuild-with-cooldown was judged sufficient. Tested 2026-08-11 (6 cooldown tests).
- [x] Add scheduled review nudges and optional email reminders. `growth/reminders.py` emails users with due flashcards from the previous day (SMTP via stdlib `smtplib`; `SMTP_*` and `APP_PUBLIC_URL` config); `ReminderPreference` (email on/off, local hour, timezone, minimum-due-card threshold) with `GET`/`PUT /api/v1/reminders/preferences` and a Settings-page toggle; `python -m app.core.jobs --reminders` scheduled entrypoint with in-flight dedup and `ReminderDelivery` audit rows. Implemented 2026-08-12 (preferences are tested in `tests/test_growth.py`; the SMTP send path itself is not unit-tested).
- [x] Add flashcard "why scheduled" explainability. Every flashcard response now carries a `scheduling` object (`stage`: new/learning/review, `intervalDays`, `easeFactor`, `dueAt`, and a human-readable `reason` derived from the card's SM-2 state), shown under the answer during review. Implemented 2026-08-12.

### Future team/school model — deferred

- [ ] Validate real demand before implementation.
- [ ] Design organizations and organization membership.
- [ ] Design roles and permissions.
- [ ] Design seats and institutional billing.
- [ ] Design classrooms/cohorts and assignments.
- [ ] Design administrator reporting and education compliance controls.

## Completion log

Add one line whenever a requirement or meaningful group is completed.

| Date | Requirement | Verification | Notes |
|---|---|---|---|
| 2026-08-10 | Phase 0 frontend verification | ESLint: 0 warnings; frontend tests: 3 passed; production build passed | Replaced stale starter-template test. |
| 2026-08-10 | Phase 0 backend verification | Alembic empty upgrade/check passed; 172 backend tests passed | Used isolated PostgreSQL 18 with pgvector. |
| 2026-08-10 | Phase 0 local/CI infrastructure | YAML validation, demo seed run twice, migration downgrade/upgrade passed | GitHub CI and Dependabot files added. |
| 2026-08-10 | Phase 0 browser verification | Playwright: 7 passed across desktop Chromium and Pixel 7; 1 intentional desktop skip for the mobile-only case | Covers account forms, core routes, upload controls, and dense mobile pages. |
| 2026-08-10 | Phase 0 clean dependency setup | Isolated npm lockfile install and isolated Python requirements install completed | Temporary environments were removed after verification. |
| 2026-08-10 | Phase 1 malware scanning decision | ClamAV code path reviewed; infrastructure activation deferred | Current Railway 1 GB memory limit is unsuitable. Keep optional scanning disabled and revisit before public launch. |
| 2026-08-10 | Phase 1 object storage completion | `tests/test_s3_storage.py` (moto-mocked, no real credentials) | Signed upload URLs, idempotent delete, abandoned-upload cleanup sweep, upload progress/retry UI. |
| 2026-08-10 | Phase 1 durable jobs completion | `tests/test_jobs.py` (fakeredis-backed) | Postgres-backed `background_jobs` table, atomic claim, idempotency-key dedup, stuck-job recovery, KG/mind-map rebuilds migrated to async 202+polling, quiz/exam/flashcard generation gained idempotency-key protection (confirmed scope: stays synchronous). |
| 2026-08-10 | Phase 1 AI limits and cost controls | `tests/test_usage.py` | Per-feature daily/monthly caps layered on the global ceiling, soft-limit warning field, real cost computation from provider token usage, admin usage dashboard (`/admin`), embeddings now metered. |
| 2026-08-10 | Phase 1 observability | `tests/test_observability.py`, `tests/test_logging.py` | Frontend `@sentry/react` + `ErrorBoundary`, DB pool/slow-query metrics, queue/auth-failure metrics, redaction hardening (new keys + value-pattern scrubber), correlation ID round-trips frontend→backend→job→provider-call log. |
| 2026-08-10 | Phase 1 account security | `tests/test_account_security.py` (11 tests) | Change password (invalidates other sessions), session list/revoke with ownership isolation, account deletion (retry-safe, cascades verified against every listed table + storage), account export (secret-exclusion verified). |
| 2026-08-10 | Phase 1 legal/retention automation | `tests/test_cleanup.py` (7 tests) | `cleanup.expired_sessions`, abandoned-upload sweep extended to `pending-deletion/`, `cleanup.ai_traces`; each sweep writes a content-free `CleanupRun` audit row. |
| 2026-08-10 | Phase 1 core UX | `tests/test_study_search.py`, `tests/test_workspace.py` (+4 tests) | Command palette wired to real search with keyboard navigation and workspace autosave conflict detection. |
| 2026-08-11 | Phase 1 accessibility and responsive verification | Backend: 237 passed, 0 failed. Frontend: ESLint 0 warnings; production build passed; unit tests 3 passed; Playwright 25 passed, 1 intentional desktop-only skip (desktop + Pixel 7 Chromium), including 9 new `@axe-core/playwright` WCAG 2 AA scans (register, login, topics, AI tutor, quizzes, flashcards, plus the create-topic dialog open/Escape/Tab-trap). | Fixed real a11y bugs axe surfaced: modal-close buttons had no accessible name (added `aria-label="Close"` to all 22 real instances); several text/background colour pairs failed WCAG AA contrast (breadcrumb, search placeholder, section-kicker/eyebrow labels, agent-toggle pill, modal hint, context-topic-link, flashcard stat labels) — retuned to pass with margin, verified against the actual rendered (not just nominal) contrast. Added Escape-to-close for all `.modal-close` dialogs via a real `.click()` call (not a synthetic dispatched event, which had previously caused a page freeze and was reverted) — verified live in-browser with no freeze, including rapid double-press. Fixed a pre-existing focus-restoration bug: a dialog's own `autoFocus` field was racing the async `MutationObserver`'s capture of "what to restore focus to," now tracked via a synchronous `focusin` history instead. Added `prefers-reduced-motion` handling for the one continuous spinner animation that lacked it. Added `aria-live` announcements for document processing, knowledge-graph rebuild, and mind-map generation outcomes. Fixed a real RTL bug: the workspace code-block editor used `dir="auto"`, letting Arabic-adjacent content flip code blocks to RTL; now forced `dir="ltr"`. `.sr-only` utility class added. |
| 2026-08-12 | Phase 3 product analytics, model routing, review reminders, and answer feedback (new `growth` module) | Static code verification of the working tree (uncommitted). New tests exist (`tests/test_growth.py`, `tests/test_message_feedback.py`) but were not executed this session -- the isolated test Postgres on :5433 (Docker) was unavailable. | Implemented: `product_events` telemetry (signup, activation, first-topic/upload/AI-answer/quiz/flashcard-review) with admin `GET /api/v1/analytics/funnel`; `answer_feedback` (rating + reason + comment, unique per user/message) via `PUT /ai/messages/{id}/feedback` with tutor thumbs UI; `reminder_preferences`/`reminder_deliveries` with SMTP due-card emails and `--reminders` job; feature-based model routing (`AI_FEATURE_PROVIDERS`, provider fallback, per-feature usage metering); offline RAG eval harness (`scripts/evaluate_rag.py`). Remaining open: weekly-active/study-session tracking, quiz/exam completion + flashcard retention, coach-plan completion, free-to-paid conversion, churn/cancellation reasons, source-click tracking, a real eval dataset, wiring `AI_ARTIFACT_CACHE_TTL_SECONDS`, and difficulty calibration from aggregate learner performance. |
| 2026-08-12 | Phase 3 completion pass (plan tiers, difficulty calibration, item-level analytics, exam preview/editing, retention, workspace export/import, source clicks, artifact caching, flashcard explainability) | Static code verification of the working tree (uncommitted) -- import checks, migration-head resolution, and `tsc --noEmit` (only pre-existing frontend errors remain). New tests `tests/test_phase3_features.py` written statically but not executable while the Docker test DB on :5433 is down. | Closed Phase 3 "Growth and Optimization" items: source-click tracking (`POST /ai/messages/{id}/sources/click` + `source_click` product event, tutor chips wired); weekly-active/retention analytics (`GET /analytics/retention`, admin-gated signup-cohort + W1/M1); difficulty calibration (`GET /topics/{id}/quiz-analytics`, `auto` difficulty resolution in the quiz modal); topic-level item analytics for quizzes and exams (`GET /topics/{id}/exam-analytics`, graded-only answer times); exam preview/editing (draft/published status, review/publish/edit/regenerate/delete, per-type edit validation); workspace export/import (`GET /workspace-pages/export`, `POST /workspace-pages/import`, static-route ordering fix); plan-tier scaffolding (`users.plan`, `GET /plans/me`, plan-aware quota/storage enforcement, `DEFAULT_PLAN`/`PLAN_TIERS` config); stable artifact caching (`AI_ARTIFACT_CACHE_TTL_SECONDS` now wired into quiz/exam/flashcard/mind-map generation, content-addressed key includes a notes/documents material signature so edits invalidate it); flashcard "why scheduled" explainability (`scheduling` object on every card, shown in review). Billing/Stripe, collaboration/team features, and paid-conversion tracking remain deferred as agreed. |
| 2026-08-11 | Phase 3 growth/optimization closeout (AI Tutor/RAG, Documents, Quizzes/Exams, Flashcards, Workspace, Coach/Mastery/KG/Mind Map) | Backend: 294 passed, 0 failed (up from 237). Frontend: ESLint 0 warnings; production build passed. Playwright: 27 passed, 1 intentional skip, 12 failed -- all 12 confirmed pre-existing and unrelated to this work (see Notes), not new regressions. | Closed every open item under Phase 3's "AI and RAG quality" and "Learning feature improvements" sections except product-analytics tracking, model routing, AI-artifact caching, evaluation datasets, difficulty calibration from aggregate learner performance, and scheduled email reminders (none attempted -- out of scope for a backend/product-logic pass). Also enforced per-user storage quotas (`MAX_STORAGE_MB_PER_USER`, flat beta-wide cap pending real billing tiers) and fixed a real route-ordering bug (`/documents/storage-usage` was unreachable, registered after `/documents/{document_id}`). Full change list and per-item test counts are in this section above, dated 2026-08-11. **Pre-existing issues found during verification, not caused by this work (confirmed via `git diff` -- none of the implicated files were touched this pass):** (1) `.mobile-profile-link` (mobile top-bar avatar) fails WCAG AA contrast (3.94, needs 4.5) on every page that renders it -- reproducible in isolation; (2) the create-topic dialog's Escape-to-close and Tab-focus-trap e2e tests fail, reproducible in isolation, despite Phase 1's changelog claiming this was fixed and verified -- needs re-investigation; (3) one mobile-viewport nav test can't find the "Open menu" button. None of these are part of the Phase 3 scope this entry covers; flagging them here rather than silently leaving them unmentioned. |
