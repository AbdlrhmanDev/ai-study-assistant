'use client'
const COOKIES = [
  {
    category: 'Strictly necessary',
    catColor: '#2e7a59', catBg: '#e4f4ee',
    desc: 'Required for the service to function. Cannot be disabled.',
    items: [
      { name: 'studia_session', purpose: 'Keeps you signed in across page loads', expires: 'Session', provider: 'Studia' },
      { name: 'studia_theme', purpose: 'Remembers your light/dark mode preference', expires: '1 year', provider: 'Studia' },
      { name: 'studia_csrf', purpose: 'Prevents cross-site request forgery attacks', expires: 'Session', provider: 'Studia' },
    ],
  },
  {
    category: 'Functional',
    catColor: '#6d5ef6', catBg: '#ede9ff',
    desc: 'Improve the experience by remembering your preferences.',
    items: [
      { name: 'studia_locale', purpose: 'Stores your preferred language and region', expires: '1 year', provider: 'Studia' },
      { name: 'studia_sidebar', purpose: 'Remembers whether the sidebar is collapsed', expires: '6 months', provider: 'Studia' },
    ],
  },
  {
    category: 'Analytics',
    catColor: '#3a8fa5', catBg: '#e4f4f8',
    desc: 'Help us understand how the app is used so we can improve it. All analytics are first-party — we do not use Google Analytics or third-party tracking.',
    items: [
      { name: 'studia_anon_id', purpose: 'Pseudonymous ID for aggregated usage analytics', expires: '2 years', provider: 'Studia' },
      { name: 'studia_session_ref', purpose: 'Associates events within a single session for funnel analysis', expires: 'Session', provider: 'Studia' },
    ],
  },
]

export default function Cookies() {
  return (
    <div>
      <section style={{ padding: '72px 24px 40px', maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-subtle)', marginBottom: 12 }}>Last updated: August 2026</p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 18 }}>
          Cookie policy
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-2)', lineHeight: 1.65 }}>
          We use only the cookies we need. No advertising networks, no third-party tracking pixels.
        </p>
      </section>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 96px', display: 'flex', flexDirection: 'column', gap: 40 }}>
        {COOKIES.map((cat, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: cat.catColor, background: cat.catBg, borderRadius: 6, padding: '3px 10px' }}>{cat.category}</span>
            </div>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>{cat.category} cookies</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 18, lineHeight: 1.65 }}>{cat.desc}</p>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 2fr 100px 100px', gap: 0, background: 'var(--color-bg)', padding: '10px 18px', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-2)', letterSpacing: '0.04em' }} className="cookie-row-hd">
                <span>NAME</span><span>PURPOSE</span><span>EXPIRES</span><span>PROVIDER</span>
              </div>
              {cat.items.map((item, j) => (
                <div key={j} style={{ display: 'grid', gridTemplateColumns: '1.6fr 2fr 100px 100px', gap: 0, padding: '14px 18px', background: j % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)', borderTop: '1px solid #edeae4', alignItems: 'start' }} className="cookie-row">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'monospace', letterSpacing: '-0.01em' }}>{item.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.5, paddingRight: 16 }}>{item.purpose}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{item.expires}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{item.provider}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ background: 'var(--color-bg)', borderRadius: 16, padding: '28px' }}>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>Managing cookies</h3>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.7, marginBottom: 12 }}>
            You can clear or block cookies at any time in your browser settings. Note that disabling strictly necessary cookies will prevent you from staying signed in.
          </p>
          <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.7 }}>
            For questions or to opt out of analytics cookies, email <span style={{ color: '#6d5ef6', fontWeight: 500 }}>privacy@studia.app</span>.
          </p>
        </div>
      </section>

      <style>{`
        @media (max-width: 600px) {
          .cookie-row-hd { display: none !important; }
          .cookie-row { grid-template-columns: 1fr !important; gap: 4px !important; }
          .cookie-row > span:not(:first-child)::before { content: attr(data-label); display: block; font-size: 10px; color: #a8a3a0; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
        }
      `}</style>
    </div>
  )
}
