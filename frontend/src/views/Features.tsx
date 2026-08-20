'use client'
import { useNavigate } from '../lib/navigation'

const FEATURES = [
  {
    tag: 'AI Tutor', icon: '💬', color: '#6d5ef6', bg: '#ede9ff',
    title: 'A tutor that read your notes',
    desc: 'Ask any question and get an answer grounded in your own uploaded material — not the generic internet. Every response cites the exact source so you can verify and go deeper.',
    points: ['Answers from your material only', 'Inline source citations', 'Follows up with clarifying questions', 'Works across all your topics simultaneously'],
  },
  {
    tag: 'Flashcards', icon: '🃏', color: '#5ab58e', bg: '#e4f4ee',
    title: 'Spaced repetition, automated',
    desc: "Upload a PDF and get a complete flashcard deck in seconds. Studia's spaced-repetition algorithm schedules each card based on how well you actually know it.",
    points: ['Auto-generated from any material', 'SM-2 spaced repetition algorithm', 'Self-rating per card (Forgot → Easy)', 'Due counts update daily'],
  },
  {
    tag: 'Quizzes', icon: '📝', color: '#e8845a', bg: '#faeee7',
    title: 'Adaptive quizzes from your content',
    desc: 'Multiple choice, true/false, short answer — all generated from your notes. Weak areas surface more often. Wrong answers feed directly into your Mistake notebook.',
    points: ['5 question types', 'Difficulty adapts to your performance', 'Instant explanations for wrong answers', 'Feeds mistake notebook automatically'],
  },
  {
    tag: 'Study Coach', icon: '🎯', color: '#c04a8b', bg: '#faeaf3',
    title: 'A plan that closes the loop',
    desc: 'Your personalised study plan updates daily based on what you know, what you got wrong, and how far away your exam is. No more guessing what to study next.',
    points: ['Daily prioritised task list', 'Exam countdown with readiness score', 'Adjusts automatically as you study', 'Integrates mistakes, gaps, and due cards'],
  },
  {
    tag: 'Workspace', icon: '✏️', color: '#7c6fa5', bg: '#f0eeff',
    title: 'Notion-like notes, linked to your study system',
    desc: 'Write or paste notes in a block-based editor. Link each page to a topic so the AI tutor and flashcard generator can draw from it automatically.',
    points: ['Block-based editor', 'Link pages to topics', 'AI can reference your notes', 'Works alongside PDF uploads'],
  },
  {
    tag: 'Analytics', icon: '📊', color: '#3a8fa5', bg: '#e4f4f8',
    title: 'See exactly where you stand',
    desc: 'Mastery percentages, study streaks, recall rates, and topic-by-topic breakdowns. Know at a glance which concepts are solid and which are slipping.',
    points: ['Per-topic mastery tracking', 'Study time breakdown', 'Recall rate over time', 'Weak concept identification'],
  },
]

export default function Features() {
  const navigate = useNavigate()

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: '80px 24px 64px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9ff', borderRadius: 999, padding: '5px 14px', marginBottom: 24, fontSize: 12, fontWeight: 600, color: '#6d5ef6' }}>
          Everything in one system
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20 }}>
          Every tool talks to each other
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--color-text-2)', maxWidth: 560, margin: '0 auto 36px' }}>
          Studia isn't a collection of separate tools. Every feature feeds into the others — wrong answers become flashcards, weak concepts become coach tasks, notes become quiz questions.
        </p>
        <button onClick={() => navigate('/app')} style={{ fontSize: 14.5, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 11, padding: '13px 26px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(109,94,246,0.35)' }}>
          Try it free →
        </button>
      </section>

      {/* Feature cards */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ background: 'var(--color-surface)', borderRadius: 20, border: '1px solid var(--color-border)', padding: '28px 28px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{f.icon}</div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: f.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{f.tag}</span>
              </div>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10, lineHeight: 1.25 }}>{f.title}</h2>
                <p style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 7, listStyle: 'none', padding: 0, margin: 0 }}>
                {f.points.map((pt, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--color-text-2)' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={f.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3"/></svg>
                    </div>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#18160f', padding: '72px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#f7f5f1', marginBottom: 16, letterSpacing: '-0.02em' }}>
          Ready to study smarter?
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(247,245,241,0.5)', marginBottom: 32 }}>Free beta. No credit card. Cancel anytime.</p>
        <button onClick={() => navigate('/app')} style={{ fontSize: 15, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 12, padding: '14px 30px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(109,94,246,0.4)' }}>
          Start for free
        </button>
      </section>
    </div>
  )
}
