'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, idempotencyHeader, messageFromError, type Topic } from '../lib/api'
import { useNavigate } from '../lib/navigation'

type Stats = { topic_id:number; total:number; due_today:number; difficult:number; retention_rate:number|null; next_review_at:string|null }
type Summary = { due_today:number; difficult:number; retention_rate:number|null; next_review_at:string|null }

const COLORS = ['#6d5ef6', '#e8845a', '#5ab58e', '#d5a928', '#9b7ea5']
const ICONS = ['🃏', '📚', '💊', '🧠', '📖']

export default function Flashcards() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<Topic[]>([])
  const [stats, setStats] = useState<Stats[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [topicId, setTopicId] = useState(0)
  const [count, setCount] = useState(8)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [topicResult, statResult, summaryResult] = await Promise.all([
        api<{topics: Topic[]}|Topic[]>('/topics'),
        api<{stats: Stats[]}>('/flashcards/stats-by-topic'),
        api<Summary>('/flashcards/stats-summary'),
      ])
      const list = Array.isArray(topicResult) ? topicResult : topicResult.topics
      setTopics(list); setStats(statResult.stats); setSummary(summaryResult)
      if (list[0]) setTopicId(value => value || list[0].id)
    } catch (reason) { setError(messageFromError(reason)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const decks = useMemo(() => topics.map((topic, index) => ({
    topic, color: COLORS[index % COLORS.length], icon: ICONS[index % ICONS.length],
    stats: stats.find(item => item.topic_id === topic.id) ?? { topic_id:topic.id, total:0, due_today:0, difficult:0, retention_rate:null, next_review_at:null },
  })), [topics, stats])
  const totalCards = stats.reduce((sum, item) => sum + item.total, 0)
  const retention = normalizePercent(summary?.retention_rate)

  const generate = async () => {
    setBusy(true); setError('')
    try {
      await api(`/topics/${topicId}/flashcards/generate`, { method:'POST', headers:idempotencyHeader(), body:JSON.stringify({ source:'topic', count }) })
      setShowGenerate(false); await load()
    } catch (reason) { setError(messageFromError(reason)) }
    finally { setBusy(false) }
  }

  return <main className="flashcards-page">
    <header className="flashcards-header">
      <div><h1>Flashcards</h1><p>{summary?.due_today ?? 0} cards due today across all topics</p></div>
      <div className="flashcards-actions">
        <button className="button secondary" onClick={() => setShowGenerate(true)}>Generate with AI</button>
        <button className="button primary" onClick={() => navigate('/app/flashcards/review')}>Review all due →</button>
      </div>
    </header>

    {error && <div className="error-message">{error}</div>}

    <section className="summary-grid" aria-label="Flashcard summary">
      <SummaryCard icon="🃏" value={loading ? '—' : summary?.due_today ?? 0} label="Cards due today" />
      <SummaryCard icon="🎯" value={loading ? '—' : retention == null ? '—' : `${retention}%`} label="Avg. retention" />
      <SummaryCard icon="📚" value={loading ? '—' : totalCards} label="Total cards" />
    </section>

    <section className="deck-list" aria-label="Flashcard decks">
      {decks.map(({ topic, stats: deck, color, icon }) => {
        const rate = normalizePercent(deck.retention_rate)
        const progress = rate ?? 0
        return <article className="deck-card" key={topic.id} style={{ '--deck-color': color, '--deck-progress': `${progress}%` } as React.CSSProperties}>
          <div className="deck-content">
            <div className="deck-identity">
              <div className="deck-icon">{icon}</div>
              <div><h2>{topic.title}</h2><div className="deck-meta"><strong>{deck.total}</strong> total <b style={{color}}>{deck.due_today}</b> due {deck.difficult > 0 && <><b className="new-count">{deck.difficult}</b> difficult</>}</div></div>
            </div>
            <div className="deck-controls">
              <div className="retention-wrap"><RetentionRing value={rate} color={color}/><span>Retention</span></div>
              <button className="button manage" onClick={() => navigate(`/app/topics/${topic.id}`)}>Manage</button>
              <button className="button review" disabled={deck.due_today === 0} onClick={() => navigate(`/app/flashcards/review?topicId=${topic.id}`)}>
                {deck.due_today > 0 ? `Review ${deck.due_today}` : deck.next_review_at ? `Next: ${new Date(deck.next_review_at).toLocaleDateString(undefined,{weekday:'short'})}` : 'Nothing due'}
              </button>
            </div>
          </div><div className="deck-progress" />
        </article>
      })}
      {!loading && !decks.length && <div className="empty-card">Create your first topic to generate flashcards.</div>}
    </section>

    {showGenerate && <div className="modal-overlay" onClick={() => setShowGenerate(false)}><div className="generate-modal" role="dialog" aria-modal="true" aria-labelledby="generate-title" onClick={event => event.stopPropagation()}>
      <small>AI GENERATION</small><h2 id="generate-title">Generate flashcards</h2>
      <label>Source topic<select value={topicId} onChange={e => setTopicId(Number(e.target.value))}>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
      <label>Number of cards<input type="number" min={1} max={20} value={count} onChange={e => setCount(Number(e.target.value))}/></label>
      <div className="modal-actions"><button className="button secondary" onClick={() => setShowGenerate(false)}>Cancel</button><button className="button primary" disabled={busy || !topicId} onClick={generate}>{busy ? 'Generating…' : 'Generate with AI ✦'}</button></div>
    </div></div>}

    <style>{`
      .flashcards-page{padding:28px 32px 70px;max-width:1320px;margin:0 auto;color:var(--color-text)}
      .flashcards-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:38px}.flashcards-header h1{font:700 40px/1.1 'Fraunces',Georgia,serif;letter-spacing:-.025em;margin:0 0 12px}.flashcards-header p{font-size:16px;color:var(--color-text-muted);margin:0}.flashcards-actions{display:flex;gap:12px}
      .button{font:600 15px 'Outfit',sans-serif;border-radius:12px;padding:14px 22px;cursor:pointer;transition:transform .15s,opacity .15s,background .15s;border:0;white-space:nowrap}.button:hover:not(:disabled){transform:translateY(-1px)}.button.primary,.button.review{background:#6d5ef6;color:#fff}.button.secondary,.button.manage{background:var(--color-surface);color:var(--color-text-2);border:1px solid var(--color-border)}.button:disabled{cursor:default;opacity:.55}
      .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:38px}.summary-card{min-height:156px;padding:26px;border:1px solid var(--color-border);border-radius:19px;background:var(--color-surface);display:flex;flex-direction:column;justify-content:center}.summary-icon{font-size:24px;margin-bottom:20px}.summary-card strong{font:700 36px/1 'Fraunces',Georgia,serif;margin-bottom:13px}.summary-card span{color:var(--color-text-muted);font-size:15px}
      .deck-list{display:flex;flex-direction:column;gap:18px}.deck-card{position:relative;overflow:hidden;border:1px solid var(--color-border);border-radius:20px;background:var(--color-surface)}.deck-content{min-height:116px;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;gap:28px}.deck-identity{display:flex;align-items:center;gap:18px;min-width:0}.deck-icon{width:66px;height:66px;border-radius:17px;background:color-mix(in srgb,var(--deck-color) 10%,var(--color-surface));display:grid;place-items:center;font-size:27px;flex:0 0 auto}.deck-identity h2{font-size:19px;margin:0 0 9px}.deck-meta{font-size:14px;color:var(--color-text-muted);word-spacing:3px}.deck-meta strong,.deck-meta b{color:var(--color-text);font-weight:700}.deck-meta .new-count{color:#5ab58e}.deck-controls{display:flex;align-items:center;gap:14px}.retention-wrap{text-align:center;margin-right:4px}.retention-wrap span{display:block;color:var(--color-text-muted);font-size:12px;margin-top:3px}.retention-ring{display:block}.button.manage,.button.review{padding:12px 20px;font-size:14px}.button.review{background:var(--deck-color)}.deck-progress{height:4px;background:linear-gradient(to right,var(--deck-color) var(--deck-progress),var(--color-surface-2) var(--deck-progress))}
      .empty-card{padding:45px;text-align:center;border:1px dashed var(--color-border);border-radius:18px;color:var(--color-text-muted)}.error-message{padding:12px 16px;margin:-18px 0 20px;border-radius:10px;background:rgba(232,132,90,.12);color:#e8845a}
      .modal-overlay{position:fixed;inset:0;z-index:400;background:rgba(15,13,10,.55);display:grid;place-items:center;padding:20px}.generate-modal{width:min(440px,100%);box-sizing:border-box;padding:30px;border-radius:20px;background:var(--color-surface);border:1px solid var(--color-border);box-shadow:0 24px 70px rgba(0,0,0,.25)}.generate-modal>small{color:#6d5ef6;font-weight:700;letter-spacing:.08em}.generate-modal h2{font:700 24px 'Fraunces',serif;margin:7px 0 22px}.generate-modal label{display:block;font-size:13px;font-weight:600;margin:14px 0}.generate-modal select,.generate-modal input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:11px;border:1px solid var(--color-border);border-radius:10px;background:var(--color-bg);color:var(--color-text)}.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:22px}
      @media(max-width:800px){.flashcards-page{padding:22px 16px 80px}.flashcards-header{display:block;margin-bottom:25px}.flashcards-header h1{font-size:32px}.flashcards-actions{margin-top:20px}.summary-grid{gap:10px;margin-bottom:24px}.summary-card{min-height:120px;padding:18px}.summary-card strong{font-size:28px}.deck-content{align-items:flex-start;padding:18px;flex-direction:column}.deck-controls{width:100%;justify-content:flex-end}.deck-identity{width:100%}}
      @media(max-width:540px){.summary-grid{grid-template-columns:1fr}.summary-card{min-height:auto}.flashcards-actions{display:grid;grid-template-columns:1fr 1fr}.button{padding:12px 10px;font-size:13px}.deck-controls{display:grid;grid-template-columns:70px 1fr 1fr}.deck-icon{width:54px;height:54px}.deck-identity h2{font-size:17px}}
    `}</style>
  </main>
}

function SummaryCard({icon,value,label}:{icon:string;value:string|number;label:string}) { return <article className="summary-card"><span className="summary-icon">{icon}</span><strong>{value}</strong><span>{label}</span></article> }
function RetentionRing({value,color}:{value:number|null;color:string}) { const shown=value??0; const circumference=2*Math.PI*24; return <svg className="retention-ring" width="62" height="62" viewBox="0 0 62 62" aria-label={value==null?'No retention data':`${value}% retention`}><circle cx="31" cy="31" r="24" fill="none" stroke="var(--color-surface-2)" strokeWidth="5"/><circle cx="31" cy="31" r="24" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${circumference*shown/100} ${circumference}`} transform="rotate(-90 31 31)"/><text x="31" y="36" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{value==null?'—':`${value}%`}</text></svg> }
function normalizePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, Math.round(value <= 1 ? value * 100 : value)))
}
