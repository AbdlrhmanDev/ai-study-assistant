'use client'
import { useState } from 'react'
import { useNavigate } from '../lib/navigation'

const SECTIONS = [
  {
    title: 'Getting started',
    icon: '🚀',
    articles: [
      { title: 'Create your first topic', desc: 'How to set up a topic, upload material, and start studying in under 5 minutes.' },
      { title: 'Upload material', desc: 'Supported file types, size limits, and how to organise uploads by topic.' },
      { title: 'Your dashboard explained', desc: 'Overview of the streak, due cards, mastery score, and attention alerts.' },
      { title: 'Study coach basics', desc: 'How the daily plan is generated, and how to mark tasks as done.' },
    ],
  },
  {
    title: 'AI Tutor',
    icon: '💬',
    articles: [
      { title: 'How the AI uses your notes', desc: "The tutor only draws from material you've uploaded. Learn how citations work." },
      { title: 'Asking effective questions', desc: 'Tips for getting precise, useful answers from the AI tutor.' },
      { title: 'Switching topics mid-conversation', desc: 'How to change the active topic context without starting a new session.' },
      { title: 'AI usage limits', desc: 'Free vs Pro daily question limits and how to check your remaining quota.' },
    ],
  },
  {
    title: 'Flashcards',
    icon: '🃏',
    articles: [
      { title: 'How spaced repetition works', desc: "Studia's SM-2 implementation: intervals, ease factors, and why it works." },
      { title: 'Editing and deleting cards', desc: 'How to modify auto-generated cards or remove ones that aren\'t useful.' },
      { title: 'Rating your recall', desc: 'The Forgot / Hard / Medium / Easy scale and how it affects scheduling.' },
      { title: 'Importing existing decks', desc: 'Anki-compatible import via CSV or .apkg format.' },
    ],
  },
  {
    title: 'Quizzes',
    icon: '📝',
    articles: [
      { title: 'Question types explained', desc: 'Multiple choice, true/false, short answer, fill-in-the-blank, and matching.' },
      { title: 'Adaptive difficulty', desc: 'How Studia targets weak areas and increases difficulty as you improve.' },
      { title: 'Reviewing wrong answers', desc: 'How incorrect answers automatically populate the Mistake Notebook.' },
      { title: 'Creating a custom quiz', desc: 'Topic selection, source filtering, question count, and timed mode options.' },
    ],
  },
  {
    title: 'Workspace',
    icon: '✏️',
    articles: [
      { title: 'Block editor basics', desc: 'How to use headings, bullets, code blocks, and dividers in the editor.' },
      { title: 'Linking pages to topics', desc: 'Connect workspace notes to a topic so the AI tutor can reference them.' },
      { title: 'Slash commands', desc: 'Type / to access block types, mentions, and templates.' },
    ],
  },
  {
    title: 'Account & billing',
    icon: '⚙️',
    articles: [
      { title: 'Upgrading to Pro', desc: 'How to upgrade, what changes immediately, and how to apply a student discount.' },
      { title: 'Cancelling your subscription', desc: 'How to cancel, what happens to your data, and downgrade to Free.' },
      { title: 'Exporting your data', desc: 'Download all flashcards, notes, and quiz history as a ZIP archive.' },
    ],
  },
]

export default function Docs() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = SECTIONS.map(s => ({
    ...s,
    articles: s.articles.filter(a =>
      !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(s => s.articles.length > 0)

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: '64px 24px 48px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 24 }}>
          How can we help?
        </h1>
        <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto' }}>
          <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18160f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search docs…"
            style={{ width: '100%', padding: '14px 14px 14px 42px', borderRadius: 12, border: '1px solid var(--color-border)', fontSize: 15, color: 'var(--color-text)', outline: 'none', background: 'var(--color-surface)', boxSizing: 'border-box', boxShadow: '0 2px 12px rgba(24,22,15,0.06)' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#6d5ef6' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e8e4de' }}
          />
        </div>
      </section>

      {/* Sections */}
      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filtered.map((section) => (
            <div key={section.title} style={{ background: 'var(--color-surface)', borderRadius: 18, border: '1px solid var(--color-border)', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: 22 }}>{section.icon}</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{section.title}</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {section.articles.map((a, i) => (
                  <button key={i} onClick={() => navigate('/app')} style={{ textAlign: 'left', padding: '11px 0', borderBottom: i < section.articles.length - 1 ? '1px solid var(--color-border-soft)' : 'none', background: 'none', border: 'none', borderBottomWidth: i < section.articles.length - 1 ? 1 : 0, borderBottomStyle: 'solid', borderBottomColor: '#f0ece6', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{a.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No results for "{search}"</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-2)' }}>Try a different search, or <button onClick={() => navigate('/app')} style={{ color: '#6d5ef6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>contact support</button>.</div>
          </div>
        )}
      </section>
    </div>
  )
}
