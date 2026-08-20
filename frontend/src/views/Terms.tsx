'use client'
const SECTIONS = [
  {
    title: '1. Acceptance',
    body: `By creating an account or using Studia, you agree to these Terms of Service. If you do not agree, do not use the service. We may update these terms from time to time — if we make material changes, we will notify you in advance by email and in-app banner.`,
  },
  {
    title: '2. Your account',
    body: `You must be at least 16 years old to create an account. You are responsible for keeping your credentials secure and for all activity under your account. If you believe your account has been compromised, contact us immediately at support@studia.app.

You may not create accounts for others without their knowledge or use automated means to create accounts.`,
  },
  {
    title: '3. Acceptable use',
    body: `You agree not to use Studia to upload or generate content that is illegal, harmful, or infringes third-party rights; to attempt to reverse-engineer, scrape, or extract training data from the AI systems; to circumvent usage limits or access controls; or to use the service in any way that disrupts other users or our infrastructure.

We reserve the right to suspend or terminate accounts that violate these rules, with or without notice, depending on severity.`,
  },
  {
    title: '4. Content you upload',
    body: `You retain ownership of any material you upload. By uploading, you grant Studia a limited, non-exclusive licence to process and store the material for the purpose of providing the service to you.

You represent that you have the right to upload the material — for example, that it does not infringe copyright or contain confidential information you are not authorised to share. We are not responsible for content that violates third-party rights.`,
  },
  {
    title: '5. AI-generated content',
    body: `The AI tutor generates responses based on your uploaded material. These responses are provided for educational assistance only and should not be relied upon as professional medical, legal, or financial advice.

AI systems can make mistakes. You are responsible for verifying important information against authoritative sources.`,
  },
  {
    title: '6. Subscription and payments',
    body: `Paid plans are billed in advance on a monthly basis. All payments are processed by Stripe. Subscriptions renew automatically unless cancelled before the renewal date.

Refunds are issued at our discretion. If you cancel within 48 hours of a charge and have not meaningfully used the service in that period, we will issue a full refund.`,
  },
  {
    title: '7. Availability and changes',
    body: `We aim for high availability but do not guarantee uptime. We may modify or discontinue features with reasonable notice. We will provide at least 30 days notice before removing a core feature that paying users rely on.`,
  },
  {
    title: '8. Limitation of liability',
    body: `To the extent permitted by law, Studia's total liability for any claim arising from these terms or your use of the service is limited to the amount you paid us in the 12 months preceding the claim.

We are not liable for indirect, incidental, or consequential damages, including loss of data or exam outcomes.`,
  },
  {
    title: '9. Governing law',
    body: `These terms are governed by the laws of Ireland. Any disputes will be resolved in the courts of Dublin, Ireland, unless mandatory consumer protection laws in your jurisdiction require otherwise.`,
  },
]

export default function Terms() {
  return (
    <div>
      <section style={{ padding: '72px 24px 40px', maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-subtle)', marginBottom: 12 }}>Last updated: August 2026</p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 18 }}>
          Terms of service
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-2)', lineHeight: 1.65 }}>
          Please read these terms before using Studia. We have written them to be clear and fair.
        </p>
      </section>

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 96px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {SECTIONS.map((s, i) => (
          <div key={i} style={{ paddingBottom: 36, marginBottom: 36, borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>{s.title}</h2>
            {s.body.split('\n\n').map((para, j) => (
              <p key={j} style={{ fontSize: 15, color: 'var(--color-text-2)', lineHeight: 1.75, marginBottom: j < s.body.split('\n\n').length - 1 ? 12 : 0 }}>{para}</p>
            ))}
          </div>
        ))}

        <div style={{ background: 'var(--color-bg)', borderRadius: 16, padding: '28px', display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 8 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>📬</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Questions about these terms?</div>
            <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
              Email <span style={{ color: '#6d5ef6', fontWeight: 500 }}>legal@studia.app</span>. We are a small team and respond within a few business days.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
