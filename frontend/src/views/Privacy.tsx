'use client'
const SECTIONS = [
  {
    title: 'What we collect',
    body: `We collect information you give us directly — your name, email address, and any study material you upload. We also collect usage data: which features you use, session duration, flashcard ratings, and quiz results. This is used to power the spaced repetition algorithm and study coach.

We collect device and browser information (OS, browser version, screen size, IP address) to diagnose technical issues and improve compatibility. We do not sell any of this data.`,
  },
  {
    title: 'How we use your data',
    body: `Your uploaded material is used exclusively to power the AI tutor for your account. It is not used to train shared models or shared with other users.

Usage data helps us improve the product, personalize the study experience (mastery tracking, coach recommendations), and send you progress summaries if you opt in. We may use your email to send transactional messages (receipts, password resets) and, with your consent, product updates.`,
  },
  {
    title: 'Data storage and security',
    body: `Your data is stored on servers in the EU (Ireland) and US (Virginia) with AES-256 encryption at rest and TLS 1.3 in transit. Uploaded files are stored in isolated, access-controlled object storage. Employees access personal data only for support and engineering reasons, under strict access controls and audit logging.

We retain your data as long as your account is active. If you delete your account, all personal data is purged within 30 days.`,
  },
  {
    title: 'Third-party services',
    body: `We use a limited set of third-party services: Stripe for payment processing (they receive billing details; we never store card numbers), Postmark for transactional email, and a cloud AI provider for the tutor feature (your material is sent to them only to generate responses and is not retained beyond the request).

Analytics are handled first-party — we do not use Google Analytics or third-party tracking pixels.`,
  },
  {
    title: 'Your rights',
    body: `Under GDPR and CCPA you have the right to access, correct, export, or delete your personal data. You can do all of this from Settings → Account → Data. For requests we cannot automate, email privacy@studia.app and we will respond within 30 days.

You can withdraw consent for marketing emails at any time using the unsubscribe link in any email we send.`,
  },
  {
    title: 'Cookies',
    body: `We use strictly necessary cookies to keep you signed in and remember your preferences. We do not use advertising or tracking cookies. See our Cookies page for the full list.`,
  },
  {
    title: 'Changes to this policy',
    body: `If we make material changes, we will notify you by email and show a banner in the app at least 14 days before the change takes effect. Continued use after that date constitutes acceptance.`,
  },
]

export default function Privacy() {
  return (
    <div>
      <section style={{ padding: '72px 24px 40px', maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-subtle)', marginBottom: 12 }}>Last updated: August 2026</p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 18 }}>
          Privacy policy
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-2)', lineHeight: 1.65 }}>
          Studia is built for students. We take data handling seriously and try to be direct about what we collect and why.
        </p>
      </section>

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 96px', display: 'flex', flexDirection: 'column', gap: 40 }}>
        {SECTIONS.map((s, i) => (
          <div key={i} style={{ paddingBottom: 40, borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>{s.title}</h2>
            {s.body.split('\n\n').map((para, j) => (
              <p key={j} style={{ fontSize: 15, color: 'var(--color-text-2)', lineHeight: 1.75, marginBottom: j < s.body.split('\n\n').length - 1 ? 14 : 0 }}>{para}</p>
            ))}
          </div>
        ))}

        <div style={{ background: 'var(--color-bg)', borderRadius: 16, padding: '28px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>✉️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Questions about this policy?</div>
            <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
              Email us at <span style={{ color: '#6d5ef6', fontWeight: 500 }}>privacy@studia.app</span>. We respond within 2 business days.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
