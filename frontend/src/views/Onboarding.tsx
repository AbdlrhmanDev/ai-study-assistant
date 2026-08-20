'use client'
import { useState } from 'react'
import { useNavigate } from '../lib/navigation'
import { api, messageFromError, type Topic } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const GOALS = [
  { id: 'usmle',   label: 'Medical boards',        sub: 'USMLE, COMLEX, NCLEX',          icon: '🩺' },
  { id: 'law',     label: 'Bar exam',               sub: 'MBE, MEE, state bar',            icon: '⚖️' },
  { id: 'grad',    label: 'Graduate school',        sub: 'GRE, GMAT, LSAT, MCAT',         icon: '🎓' },
  { id: 'cert',    label: 'Professional cert.',     sub: 'CPA, CFA, PMP, AWS, etc.',       icon: '📜' },
  { id: 'uni',     label: 'University courses',     sub: 'Lectures, textbooks, exams',     icon: '📚' },
  { id: 'other',   label: 'Something else',         sub: 'Self-directed learning',         icon: '✨' },
]

const IMPORT_OPTIONS = [
  { id: 'pdf',   label: 'Upload a PDF',        sub: 'Lecture slides, textbooks, notes',  icon: '📄' },
  { id: 'doc',   label: 'Upload a document',   sub: 'Word, text, or markdown file',       icon: '📝' },
  { id: 'anki',  label: 'Import from Anki',    sub: 'Bring your existing flashcard decks',icon: '🃏' },
  { id: 'later', label: 'Skip for now',        sub: "I'll add material later",            icon: '→' },
]

const TOTAL_STEPS = 4

function ProgressDots({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 36 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{ height: 4, borderRadius: 2, background: i < current ? '#6d5ef6' : i === current ? '#6d5ef6' : 'var(--color-border)', width: i === current ? 24 : 8, transition: 'all 0.3s' }} />
      ))}
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState('')
  const [topicName, setTopicName] = useState('')
  const [topicExam, setTopicExam] = useState('')
  const [topicDate, setTopicDate] = useState('')
  const [importChoice, setImportChoice] = useState('')
  const [createdTopic, setCreatedTopic] = useState<Topic | null>(null)
  const [error, setError] = useState('')

  const next = () => setStep(s => s + 1)
  const createTopic = async () => {
    setError('')
    try {
      const result = await api<{ topic: Topic }>('/topics', { method: 'POST', body: JSON.stringify({ title: topicName.trim(), description: topicExam.trim() || null }) })
      setCreatedTopic(result.topic)
      if (topicDate) await api(`/topics/${result.topic.id}/study-goal`, { method: 'PUT', body: JSON.stringify({ examDate: topicDate, availableMinutesPerDay: 60 }) })
      next()
    } catch (reason) { setError(messageFromError(reason)) }
  }

  const inputStyle = (focused?: boolean): React.CSSProperties => ({
    width: '100%', padding: '11px 14px', borderRadius: 11,
    border: `1px solid ${focused ? '#6d5ef6' : 'var(--color-border)'}`,
    fontSize: 14, color: 'var(--color-text)', background: 'var(--color-surface-2)',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
    fontFamily: "'Outfit', system-ui, sans-serif",
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 60px', fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #7c6ff7 0%, #5a4ee0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(109,94,246,0.3)' }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>S</span>
        </div>
        <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>Studia</span>
      </div>

      <div style={{ width: '100%', maxWidth: 560 }}>
        <ProgressDots current={step} />

        {/* ── Step 0: Goal ── */}
        {step === 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 10 }}>Step 1 of {TOTAL_STEPS}</p>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 8 }}>
              What are you studying for?
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 28 }}>This helps us tailor your study experience.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => setGoal(g.id)}
                  style={{ padding: '16px', borderRadius: 14, border: `2px solid ${goal === g.id ? '#6d5ef6' : 'var(--color-border)'}`, background: goal === g.id ? 'rgba(109,94,246,0.08)' : 'var(--color-surface)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{g.icon}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: goal === g.id ? '#6d5ef6' : 'var(--color-text)', marginBottom: 3 }}>{g.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{g.sub}</div>
                </button>
              ))}
            </div>
            <button onClick={next} disabled={!goal} style={{ width: '100%', padding: '13px', borderRadius: 12, background: goal ? '#6d5ef6' : 'var(--color-border)', color: goal ? '#fff' : 'var(--color-text-muted)', fontWeight: 700, fontSize: 15, border: 'none', cursor: goal ? 'pointer' : 'not-allowed', boxShadow: goal ? '0 4px 14px rgba(109,94,246,0.3)' : 'none', transition: 'all 0.15s' }}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 1: First topic ── */}
        {step === 1 && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '36px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Step 2 of {TOTAL_STEPS}</p>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 6 }}>Create your first topic</h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 28, lineHeight: 1.6 }}>A topic is where all your notes, flashcards, and quizzes for one subject live.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Topic name <span style={{ color: '#c04a2b' }}>*</span></label>
                <input value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="e.g. Organic Chemistry, Constitutional Law" style={inputStyle()}
                  onFocus={e => { e.target.style.borderColor = '#6d5ef6'; e.target.style.background = 'var(--color-surface)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.background = 'var(--color-surface-2)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Target exam <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input value={topicExam} onChange={e => setTopicExam(e.target.value)} placeholder="e.g. USMLE Step 1, Biochemistry Final" style={inputStyle()}
                  onFocus={e => { e.target.style.borderColor = '#6d5ef6'; e.target.style.background = 'var(--color-surface)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.background = 'var(--color-surface-2)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Exam date <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="date" value={topicDate} onChange={e => setTopicDate(e.target.value)} style={inputStyle()}
                  onFocus={e => { e.target.style.borderColor = '#6d5ef6'; e.target.style.background = 'var(--color-surface)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.background = 'var(--color-surface-2)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(0)} style={{ padding: '12px 20px', borderRadius: 12, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Back</button>
              <button onClick={() => void createTopic()} disabled={!topicName.trim()} style={{ flex: 1, padding: '12px', borderRadius: 12, background: topicName.trim() ? '#6d5ef6' : 'var(--color-border)', color: topicName.trim() ? '#fff' : 'var(--color-text-muted)', fontWeight: 700, fontSize: 15, border: 'none', cursor: topicName.trim() ? 'pointer' : 'not-allowed', boxShadow: topicName.trim() ? '0 4px 14px rgba(109,94,246,0.3)' : 'none', transition: 'all 0.15s' }}>
                Create topic
              </button>
            </div>
            {error && <p style={{ color: '#e8845a', fontSize: 13 }}>{error}</p>}
          </div>
        )}

        {/* ── Step 2: Upload material ── */}
        {step === 2 && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '36px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Step 3 of {TOTAL_STEPS}</p>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 6 }}>Add your study material</h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Upload notes, slides, or textbook chapters for <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{topicName || 'your topic'}</strong>. The AI tutor uses these as its source of truth.
            </p>

            {/* Drop zone */}
            <div style={{ border: `2px dashed ${importChoice === 'pdf' || importChoice === 'doc' ? '#6d5ef6' : 'var(--color-border)'}`, borderRadius: 14, padding: '28px', textAlign: 'center', marginBottom: 16, background: importChoice === 'pdf' || importChoice === 'doc' ? 'rgba(109,94,246,0.04)' : 'transparent', transition: 'all 0.15s', cursor: 'pointer' }}
              onClick={() => setImportChoice('pdf')}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Drop files here or click to browse</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>PDF, DOCX, TXT, MD — up to 50 MB per file</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {IMPORT_OPTIONS.slice(2).map(o => (
                <button key={o.id} onClick={() => setImportChoice(o.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 12, border: `2px solid ${importChoice === o.id ? '#6d5ef6' : 'var(--color-border)'}`, background: importChoice === o.id ? 'rgba(109,94,246,0.08)' : 'var(--color-surface-2)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                >
                  <span style={{ fontSize: 20 }}>{o.icon}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: importChoice === o.id ? '#6d5ef6' : 'var(--color-text)' }}>{o.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{o.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: '12px 20px', borderRadius: 12, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Back</button>
              <button onClick={next} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#6d5ef6', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,94,246,0.3)' }}>
                {importChoice === 'later' || !importChoice ? 'Skip for now' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(109,94,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>🎉</div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 12 }}>
              You're all set, {user?.name?.split(' ')[0] || 'there'}!
            </h1>
            <p style={{ fontSize: 15, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              Your first topic <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{createdTopic?.title || topicName || 'My Topic'}</strong> is saved. Start by chatting with the AI tutor or generating your first flashcard deck.
            </p>

            {/* Suggested next actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400, margin: '0 auto 32px', textAlign: 'left' }}>
              {[
                { icon: '💬', label: 'Chat with the AI tutor', sub: 'Ask anything about your material', path: '/app/ai-tutor' },
                { icon: '🃏', label: 'Generate flashcards', sub: 'Create a spaced repetition deck', path: '/app/flashcards' },
                { icon: '📊', label: 'View your dashboard', sub: 'See your study overview', path: '/app' },
              ].map((a, i) => (
                <button key={i} onClick={() => navigate(a.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s, border-color 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,94,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(109,94,246,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.sub}</div>
                  </div>
                  <svg style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>

            <button onClick={() => navigate('/app')} style={{ fontSize: 13, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Go to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
