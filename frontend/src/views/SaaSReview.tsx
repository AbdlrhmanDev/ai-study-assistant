'use client'
const READINESS = [
  { area: 'Core study workflows',  status: 'Strong',        note: 'Broad coverage across notes, AI tutor, quizzes, exams, flashcards, coach, workspace.',        color: '#2e7a59', bg: '#e4f4ee' },
  { area: 'Authentication',        status: 'Good MVP',      note: 'Server-side sessions and rate limits exist; needs password reset, email verification, account recovery.',  color: '#5a8f7c', bg: '#eaf4f0' },
  { area: 'Multi-tenancy',         status: 'Basic',         note: 'Data is user-scoped. No organization/team model, roles, seat management, or admin console.',  color: '#8b7a3a', bg: '#f8f3e2' },
  { area: 'Billing',               status: 'Missing',       note: 'No Stripe/customer/subscription/pricing/entitlement layer.',                                    color: '#c04a2b', bg: '#fde9e4' },
  { area: 'AI cost controls',      status: 'Partial',       note: 'AI rate limits exist, but no token/cost tracking, quota enforcement by plan, or usage ledger.',  color: '#8b7a3a', bg: '#f8f3e2' },
  { area: 'Storage',               status: 'Not ready',     note: 'Uploads are local filesystem only; production needs S3/R2/GCS-compatible object storage.',       color: '#c04a2b', bg: '#fde9e4' },
  { area: 'Observability',         status: 'Partial',       note: 'Structured logs and request IDs exist; needs metrics, tracing, uptime checks, alerting.',        color: '#8b7a3a', bg: '#f8f3e2' },
  { area: 'Testing',               status: 'Incomplete',    note: 'Test suites exist but cannot run without dependencies and a Postgres test DB.',                  color: '#c04a2b', bg: '#fde9e4' },
  { area: 'Deployment',            status: 'Partial',       note: 'Docker/Railway files exist; needs CI, migration strategy, secrets management, backups.',         color: '#8b7a3a', bg: '#f8f3e2' },
  { area: 'Legal/privacy',         status: 'Missing',       note: 'Needs Terms, Privacy Policy, data retention, deletion/export, AI data-processing disclosures.',  color: '#c04a2b', bg: '#fde9e4' },
  { area: 'Support/admin',         status: 'Missing',       note: 'Needs support workflow, admin visibility, abuse handling, refund/account tools.',                color: '#c04a2b', bg: '#fde9e4' },
]

const BLOCKERS = [
  {
    n: '01', title: 'Billing, Plans & Entitlements', urgency: 'Critical',
    items: ['Add Stripe billing provider', 'DB tables: customers, subscriptions, entitlements, usage ledger', 'Webhook handling for subscription lifecycle', 'Gate premium features server-side', 'Define per-plan limits for AI, uploads, storage, quizzes', 'Soft-limit UI warnings before hard limits', 'Billing/settings page'],
  },
  {
    n: '02', title: 'Replace Local Upload Storage', urgency: 'Critical',
    items: ['Implement S3/R2/GCS object storage backend', 'Store object keys in DB instead of local paths', 'Add signed upload/download flows', 'Add file deletion jobs and lifecycle policies', 'Add malware/content scanning', 'Add MIME sniffing and extension validation'],
  },
  {
    n: '03', title: 'AI Usage Metering & Cost Controls', urgency: 'Critical',
    items: ['Track provider, model, tokens, cost per AI call', 'Enforce monthly quotas by plan', 'Per-feature limits: chat, image, quiz, exam, flashcard, mind map', 'Admin alerts for cost spikes', 'Graceful degradation when quota exhausted', 'Prompt/version logging for quality debugging'],
  },
  {
    n: '04', title: 'Rebuild the Test Pipeline', urgency: 'High',
    items: ['CI: npm ci, lint, build, tests, backend deps, pytest, Alembic checks', 'Disposable Postgres + pgvector in CI', 'Smoke tests for core journeys', 'Frontend integration tests with Playwright', 'Rewrite stale rendered-html.test.mjs'],
  },
  {
    n: '05', title: 'Account Lifecycle Features', urgency: 'High',
    items: ['Email verification', 'Password reset + change', 'Delete account + export all data', 'Session/device management', 'Transactional emails with deliverability monitoring', 'Optional magic link / OAuth later'],
  },
  {
    n: '06', title: 'Legal, Privacy & Compliance', urgency: 'High',
    items: ['Terms of Service', 'Privacy Policy', 'Cookie notice', 'Data retention policy', 'Data deletion and export flow', 'AI processing disclosure', 'DPA-ready vendor list', 'Age-gating and student-data compliance review'],
  },
]

const PHASES = [
  {
    phase: 0, label: 'Phase 0', title: 'Stabilize the Build', color: '#6d5ef6', bg: 'rgba(109,94,246,0.08)', border: 'rgba(109,94,246,0.2)',
    goal: 'Make the repo reliably runnable by a new engineer and by CI.',
    items: ['Refresh setup docs', 'Make lint, test, pytest pass', 'Replace stale frontend test', 'Add CI pipeline', 'Add seed/demo data for QA'],
  },
  {
    phase: 1, label: 'Phase 1', title: 'Closed Beta', color: '#3a8fa5', bg: 'rgba(58,143,165,0.08)', border: 'rgba(58,143,165,0.2)',
    goal: 'Safely onboard real users without charging yet.',
    items: ['Deploy backend with managed Postgres + pgvector', 'Object storage for uploads', 'Uptime monitoring + error tracking', 'Privacy policy, terms, support email', 'Onboarding and empty states', 'AI usage logging + admin cost dashboards', 'Enforce beta limits'],
  },
  {
    phase: 2, label: 'Phase 2', title: 'Paid v1', color: '#5a8f7c', bg: 'rgba(90,143,124,0.08)', border: 'rgba(90,143,124,0.2)',
    goal: 'Charge individual users with controlled cost exposure.',
    items: ['Stripe checkout, billing portal, webhooks', 'Plan entitlements + quota enforcement', 'Usage visibility in settings', 'Transactional email for verification/billing', 'Refund/cancellation workflow', 'Production incident runbook'],
  },
  {
    phase: 3, label: 'Phase 3', title: 'Growth & Optimization', color: '#e8845a', bg: 'rgba(232,132,90,0.08)', border: 'rgba(232,132,90,0.2)',
    goal: 'Improve retention, quality, performance, and unit economics.',
    items: ['Tune RAG quality with evaluation datasets', 'Model-routing by feature to reduce cost', 'Caching for stable AI-derived artifacts', 'Scheduled review nudges and email reminders', 'Product analytics funnels', 'Collaboration/team features after demand validation'],
  },
]

const ACTIONS = [
  { n: 1, text: 'Rebuild local/CI verification — install dependencies, update stale frontend tests, make all tests pass against Postgres with pgvector.' },
  { n: 2, text: 'Implement object storage because document upload is core to the RAG value proposition.' },
  { n: 3, text: 'Add AI usage logging and quota enforcement before opening public signup.' },
  { n: 4, text: 'Add Stripe subscriptions and backend entitlements.' },
  { n: 5, text: 'Add account lifecycle and legal/privacy pages.' },
  { n: 6, text: 'Add production observability and incident runbooks.' },
]

const FRONTEND_ITEMS = [
  'Next.js 16, React 19, TypeScript, Vite, Cloudflare-oriented tooling',
  'Routes: landing, auth, dashboard, topics, workspace, coach, flashcards, quizzes, exams, AI tutor, history, analytics, settings',
  'API client with NEXT_PUBLIC_API_URL, JSON fetches, file-download helpers, cookie credentials',
  'Deployment: Dockerfile, railway.json, vite.config.ts',
]

const BACKEND_ITEMS = [
  'FastAPI with modular feature folders under backend/app/modules',
  'PostgreSQL via async SQLAlchemy + Alembic migrations',
  'pgvector + BM25 hybrid retrieval for topic-scoped RAG',
  'AI providers: Gemini, OpenAI, Groq with retry/fallback',
  'Auth: email/password + bcrypt, server-side sessions, httpOnly cookies',
  'Security: CORS allowlist, CSRF origin check, body size limits, rate limiting, structured logging, request IDs',
  'Broad backend test suite across auth, topics, notes, AI, quizzes, exams, flashcards, analytics',
]

const DOD = [
  'A new user can register, verify email, onboard, create a topic, upload material, chat with sources, generate practice, review flashcards, and see progress without manual help.',
  'Paid plans are enforced by the backend.',
  'AI usage is metered and capped.',
  'Uploads are stored durably outside the app container.',
  'CI passes from a clean checkout.',
  'Production has monitoring, alerts, backups, restore procedures, and rollback steps.',
  'Users can reset password, update profile, export data, and delete account.',
  'Legal/privacy pages are live.',
  'Support can inspect account/billing state safely without direct database access.',
]

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color, background: bg, borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>{label}</span>
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-text-muted)', flexShrink: 0, marginTop: 7 }} />
      <span style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.65 }}>{text}</span>
    </div>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 18 }}>{children}</h2>
}

export default function SaaSReview() {
  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 960, margin: '0 auto', color: 'var(--color-text)' }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Chip label="INTERNAL" color="#6d5ef6" bg="rgba(109,94,246,0.1)" />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Reviewed: Aug 5, 2026</span>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 18 }}>
          SaaS Finalization Review
        </h1>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '22px 26px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Executive Summary</div>
          <p style={{ fontSize: 15, color: 'var(--color-text-2)', lineHeight: 1.75, marginBottom: 12 }}>
            Studia is already a substantial AI study product, not just a prototype. The repo contains a full frontend and FastAPI/PostgreSQL backend with user accounts, topics, notes, document upload, RAG chat, image chat, quizzes, exams, flashcards, mastery tracking, knowledge graphs, mind maps, study coach plans, analytics, export, and gamification.
          </p>
          <p style={{ fontSize: 15, color: 'var(--color-text-2)', lineHeight: 1.75, marginBottom: 16 }}>
            The biggest gap is not feature count. The product needs <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>SaaS hardening</strong>: billing and entitlement enforcement, production object storage, operational monitoring, a refreshed test/deploy pipeline, privacy/compliance controls, usage metering for AI cost control, and a clearer product packaging strategy.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Chip label="Strong prototype" color="#2e7a59" bg="#e4f4ee" />
            <Chip label="Moderate beta readiness" color="#8b7a3a" bg="#f8f3e2" />
            <Chip label="Not yet paid SaaS-ready" color="#c04a2b" bg="#fde9e4" />
          </div>
        </div>
      </div>

      {/* Product inventory */}
      <div style={{ marginBottom: 48 }}>
        <SectionHead>Current Product Inventory</SectionHead>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="review-2col">
          {/* Frontend */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(109,94,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6d5ef6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Frontend</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FRONTEND_ITEMS.map((t, i) => <Bullet key={i} text={t} />)}
            </div>
          </div>
          {/* Backend */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(58,143,165,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a8fa5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Backend</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BACKEND_ITEMS.map((t, i) => <Bullet key={i} text={t} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Readiness table */}
      <div style={{ marginBottom: 48 }}>
        <SectionHead>Readiness Assessment</SectionHead>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 1fr', background: 'var(--color-surface-2)', padding: '10px 20px', borderBottom: '1px solid var(--color-border)' }}>
            {['Area', 'Status', 'Notes'].map(h => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>
          {READINESS.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 1fr', padding: '13px 20px', alignItems: 'start', borderBottom: i < READINESS.length - 1 ? '1px solid var(--color-border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-2)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)', paddingRight: 12 }}>{r.area}</span>
              <Chip label={r.status} color={r.color} bg={r.bg} />
              <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6, paddingLeft: 12 }}>{r.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Launch blockers */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <SectionHead>Launch Blockers</SectionHead>
          <Chip label="6 items" color="#c04a2b" bg="#fde9e4" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {BLOCKERS.map(b => (
            <div key={b.n} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: 'var(--color-border)', lineHeight: 1, letterSpacing: '-0.02em', userSelect: 'none' }}>{b.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{b.title}</span>
                  <Chip label={b.urgency} color={b.urgency === 'Critical' ? '#c04a2b' : '#8b7a3a'} bg={b.urgency === 'Critical' ? '#fde9e4' : '#f8f3e2'} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {b.items.map((item, j) => <Bullet key={j} text={item} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div style={{ marginBottom: 48 }}>
        <SectionHead>Recommended Roadmap</SectionHead>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="review-2col">
          {PHASES.map(p => (
            <div key={p.phase} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 16, padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: p.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{p.label}</span>
              </div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, lineHeight: 1.2 }}>{p.title}</div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5, fontStyle: 'italic' }}>{p.goal}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {p.items.map((item, j) => (
                  <div key={j} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', borderWidth: 1.5, borderStyle: 'solid', borderColor: p.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.color }} />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Definition of Done */}
      <div style={{ marginBottom: 48 }}>
        <SectionHead>Definition of Done — SaaS v1</SectionHead>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DOD.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', borderWidth: 1.5, borderStyle: 'solid', borderColor: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, color: 'var(--color-text-muted)', fontSize: 10 }}>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 7 5.5 10.5 12 3.5"/></svg>
              </div>
              <span style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.7 }}>{d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Immediate next actions */}
      <div>
        <SectionHead>Immediate Next Actions</SectionHead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ACTIONS.map(a => (
            <div key={a.n} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(109,94,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', Georgia, serif", fontSize: 13, fontWeight: 700, color: '#6d5ef6', flexShrink: 0 }}>{a.n}</div>
              <span style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.65, paddingTop: 3 }}>{a.text}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) { .review-2col { grid-template-columns: 1fr !important; } }
        @media (max-width: 600px) {
          div[style*="grid-template-columns: 1fr 110px 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: 1fr 110px 1fr"] > span:nth-child(3) { display: none; }
        }
      `}</style>
    </div>
  )
}
