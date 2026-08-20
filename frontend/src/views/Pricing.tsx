'use client'
import { useNavigate } from '../lib/navigation'

function Check({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 7 5.5 10.5 12 3.5"/>
    </svg>
  )
}

const PLANS = [
  {
    name: 'Free', price: '0', period: 'forever',
    desc: 'Everything you need to get started.',
    color: 'var(--color-text-2)', cta: 'Start free', accent: false,
    features: [
      '1 topic', 'Up to 50 flashcards', '5 AI tutor questions / day',
      'Basic quizzes', 'Study streak tracking', 'Mobile app',
    ],
  },
  {
    name: 'Pro', price: '14', period: 'per month',
    desc: 'The full system for serious exam prep.',
    color: '#6d5ef6', cta: 'Start 14-day free trial', accent: true,
    features: [
      'Unlimited topics', 'Unlimited flashcards & quizzes',
      'Unlimited AI tutor', 'Study coach with daily plan',
      'Mistake notebook', 'Analytics dashboard',
      'Workspace (notes editor)', 'Priority support',
    ],
  },
  {
    name: 'Team', price: '12', period: 'per seat / month',
    desc: 'For study groups, tutors, and cohorts.',
    color: '#3a8fa5', cta: 'Contact us', accent: false,
    features: [
      'Everything in Pro', 'Shared topic libraries',
      'Group analytics', 'Admin dashboard',
      'Dedicated onboarding', 'Custom billing',
    ],
  },
]

const FAQ = [
  { q: "Can I cancel anytime?", a: "Yes. Cancel from your settings at any time. You keep access until the end of your billing period." },
  { q: "What happens when the free trial ends?", a: "You're automatically moved to the Free plan. No charges, no credit card required to start." },
  { q: "Is there a student discount?", a: "Yes — 40% off Pro with a valid .edu email. Apply during checkout." },
  { q: "What formats can I upload?", a: "PDF, DOCX, TXT, and Markdown. Web page import via URL is in beta." },
  { q: "Does Studia work offline?", a: "Flashcard review works offline. AI features require an internet connection." },
]

export default function Pricing() {
  const navigate = useNavigate()

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: '72px 24px 56px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
          Simple, honest pricing
        </h1>
        <p style={{ fontSize: 17, color: 'var(--color-text-2)', lineHeight: 1.65 }}>
          Start free, upgrade when you need more. No hidden fees.
        </p>
      </section>

      {/* Plans */}
      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }} className="pricing-grid">
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              background: plan.accent ? '#18160f' : 'var(--color-surface)',
              borderRadius: 22, border: plan.accent ? 'none' : '1px solid var(--color-border)',
              padding: '32px 28px',
              boxShadow: plan.accent ? '0 24px 64px rgba(24,22,15,0.2)' : 'none',
              position: 'relative',
            }}>
              {plan.accent && (
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#6d5ef6', borderRadius: '0 0 10px 10px', padding: '4px 16px', fontSize: 11.5, fontWeight: 700, color: '#fff', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: plan.accent ? 'rgba(247,245,241,0.5)' : 'var(--color-text-2)', marginBottom: 8 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 42, fontWeight: 700, color: plan.accent ? '#f7f5f1' : 'var(--color-text)', lineHeight: 1 }}>${plan.price}</span>
                  <span style={{ fontSize: 13, color: plan.accent ? 'rgba(247,245,241,0.4)' : '#9b9590' }}>/{plan.period}</span>
                </div>
                <p style={{ fontSize: 13.5, color: plan.accent ? 'rgba(247,245,241,0.5)' : 'var(--color-text-2)' }}>{plan.desc}</p>
              </div>
              <button
                onClick={() => navigate('/app')}
                style={{
                  width: '100%', padding: '12px', borderRadius: 11, marginBottom: 24,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: plan.accent ? '#6d5ef6' : 'transparent',
                  color: plan.accent ? '#fff' : plan.color,
                  border: plan.accent ? 'none' : `1.5px solid ${plan.color}30`,
                  boxShadow: plan.accent ? '0 4px 16px rgba(109,94,246,0.4)' : 'none',
                }}
              >
                {plan.cta}
              </button>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: plan.accent ? 'rgba(247,245,241,0.7)' : 'var(--color-text-2)' }}>
                    <div style={{ flexShrink: 0 }}><Check color={plan.accent ? '#a89eff' : plan.color} /></div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 96px' }}>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 700, color: 'var(--color-text)', marginBottom: 36, textAlign: 'center' }}>Frequently asked</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {FAQ.map((f, i) => (
            <div key={i} style={{ borderBottom: i < FAQ.length - 1 ? '1px solid var(--color-border)' : 'none', padding: '22px 0' }}>
              <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>{f.q}</div>
              <div style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.65 }}>{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width: 800px) { .pricing-grid { grid-template-columns: 1fr !important; max-width: 440px; margin: 0 auto; } }
      `}</style>
    </div>
  )
}
