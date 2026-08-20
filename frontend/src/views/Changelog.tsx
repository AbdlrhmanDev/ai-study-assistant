'use client'
const ENTRIES = [
  {
    version: '1.4.0', date: 'August 2026', tag: 'Major release', tagColor: '#6d5ef6', tagBg: '#ede9ff',
    title: 'Dark mode & full mobile support',
    items: [
      { type: 'new', text: 'Dark mode with proper CSS variable theming across the entire shell' },
      { type: 'new', text: 'Native-style mobile bottom tab bar with More sheet' },
      { type: 'new', text: 'Mobile-optimised layouts for Quizzes, Mistakes, Flashcards, AI Tutor, and Workspace' },
      { type: 'improved', text: 'Fraunces + Outfit font pairing for more editorial, premium feel' },
      { type: 'improved', text: 'Sidebar uses CSS custom properties — no more filter invert hacks' },
      { type: 'fix', text: 'Fixed React border shorthand conflicts causing console warnings' },
    ],
  },
  {
    version: '1.3.0', date: 'July 2026', tag: 'Release', tagColor: '#5a8f7c', tagBg: '#e4f4ee',
    title: 'Workspace & topic icon picker',
    items: [
      { type: 'new', text: 'Notion-like workspace with block editor (text, heading, bullet, code blocks)' },
      { type: 'new', text: 'Topic icon picker with 64-emoji catalog and keyword search' },
      { type: 'new', text: 'URL bar in workspace page with topic linking and topic dropdown' },
      { type: 'new', text: 'Settings page with profile, notifications, appearance, and data tabs' },
      { type: 'improved', text: 'AI Tutor sidebar collapses to a slide-in overlay on mobile' },
    ],
  },
  {
    version: '1.2.0', date: 'June 2026', tag: 'Release', tagColor: '#5a8f7c', tagBg: '#e4f4ee',
    title: 'Study Coach and Analytics',
    items: [
      { type: 'new', text: 'Study Coach with daily plan, exam countdown, and readiness score' },
      { type: 'new', text: 'Analytics page with mastery trends, study time breakdown, and recall rate' },
      { type: 'new', text: 'Study History timeline with session-by-session breakdown' },
      { type: 'improved', text: 'Flashcard review now shows hint text and concept tag per card' },
      { type: 'fix', text: 'Progress bars in topic hub were not animating on first render' },
    ],
  },
  {
    version: '1.1.0', date: 'May 2026', tag: 'Release', tagColor: '#5a8f7c', tagBg: '#e4f4ee',
    title: 'Quizzes and Mistake Notebook',
    items: [
      { type: 'new', text: 'Quiz builder with 5 question types and difficulty settings' },
      { type: 'new', text: 'Adaptive quiz mode targets lowest-mastery concepts first' },
      { type: 'new', text: 'Mistake Notebook logs all wrong answers with AI explanation' },
      { type: 'improved', text: 'Topics page redesigned with mastery ring, card count, and exam date' },
    ],
  },
  {
    version: '1.0.0', date: 'April 2026', tag: 'Launch', tagColor: '#e8845a', tagBg: '#faeee7',
    title: 'Initial launch — beta',
    items: [
      { type: 'new', text: 'AI Tutor grounded in user-uploaded material with source citations' },
      { type: 'new', text: 'Spaced repetition flashcard system with SM-2 scheduling' },
      { type: 'new', text: 'Topic hub with mastery overview and concept graph' },
      { type: 'new', text: 'Dashboard with streak, due cards, and attention alerts' },
      { type: 'new', text: 'Landing page and onboarding flow' },
    ],
  },
]

const TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  new:      { label: 'New',      color: '#2e7a59', bg: '#e4f4ee' },
  improved: { label: 'Improved', color: '#6d5ef6', bg: '#ede9ff' },
  fix:      { label: 'Fix',      color: '#c04a2b', bg: '#fde9e4' },
}

export default function Changelog() {
  return (
    <div>
      <section style={{ padding: '72px 24px 56px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
          What's new in Studia
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-2)', lineHeight: 1.65 }}>
          Every update, improvement, and fix — in one place.
        </p>
      </section>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {ENTRIES.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 32, paddingBottom: 56 }} className="cl-entry">
              {/* Left: version + date */}
              <div style={{ width: 120, flexShrink: 0, paddingTop: 4 }} className="cl-meta">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>v{entry.version}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>{entry.date}</div>
                <div style={{ display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 700, color: entry.tagColor, background: entry.tagBg, borderRadius: 6, padding: '2px 8px' }}>
                  {entry.tag}
                </div>
              </div>

              {/* Right: content */}
              <div style={{ flex: 1, borderLeft: '2px solid #e8e4de', paddingLeft: 32 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.tagColor, border: '2px solid var(--color-bg)', position: 'absolute', marginLeft: -37, marginTop: 4, boxShadow: `0 0 0 3px ${entry.tagBg}` }} />
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 18, lineHeight: 1.25 }}>{entry.title}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {entry.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: TYPE_STYLE[item.type].color, background: TYPE_STYLE[item.type].bg, borderRadius: 5, padding: '2px 7px', flexShrink: 0, marginTop: 1 }}>
                        {TYPE_STYLE[item.type].label}
                      </span>
                      <span style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .cl-entry { position: relative; }
        @media (max-width: 600px) {
          .cl-meta { display: none; }
          .cl-entry > div:last-child { border-left: none; padding-left: 0; }
        }
      `}</style>
    </div>
  )
}
