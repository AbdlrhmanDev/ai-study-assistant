'use client'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '../lib/navigation'
import { api, messageFromError, type Topic as ApiTopic } from '../lib/api'

const ICON_CATALOG: { emoji: string; tags: string }[] = [
  { emoji: '⚗️', tags: 'chemistry lab flask science' },
  { emoji: '🧬', tags: 'biology dna genetics biochemistry' },
  { emoji: '💊', tags: 'medicine pill pharmacology drug' },
  { emoji: '🔬', tags: 'microscope biology science lab' },
  { emoji: '🧪', tags: 'test tube experiment chemistry' },
  { emoji: '🧫', tags: 'petri dish culture biology' },
  { emoji: '🧠', tags: 'brain neurology psychology mind' },
  { emoji: '🫀', tags: 'heart cardiology anatomy' },
  { emoji: '🫁', tags: 'lungs respiratory anatomy' },
  { emoji: '🦷', tags: 'tooth dentistry anatomy' },
  { emoji: '🩺', tags: 'stethoscope medicine doctor' },
  { emoji: '🏥', tags: 'hospital medicine health clinic' },
  { emoji: '📚', tags: 'books study reading library' },
  { emoji: '📖', tags: 'book open reading study' },
  { emoji: '📝', tags: 'notes writing memo study' },
  { emoji: '✏️', tags: 'pencil write edit notes' },
  { emoji: '🎓', tags: 'graduation school university exam' },
  { emoji: '🏛️', tags: 'university college institution history' },
  { emoji: '📐', tags: 'triangle ruler geometry math' },
  { emoji: '📏', tags: 'ruler measure math geometry' },
  { emoji: '🔭', tags: 'telescope astronomy space physics' },
  { emoji: '🌍', tags: 'earth geography world science' },
  { emoji: '🌱', tags: 'plant biology botany growth' },
  { emoji: '🌊', tags: 'wave ocean physics fluid' },
  { emoji: '💻', tags: 'computer programming coding tech' },
  { emoji: '⚙️', tags: 'gear settings engineering mechanics' },
  { emoji: '🔧', tags: 'wrench tool engineering fix' },
  { emoji: '🛠️', tags: 'tools engineering build repair' },
  { emoji: '💡', tags: 'idea light bulb concept innovation' },
  { emoji: '🔑', tags: 'key unlock access security' },
  { emoji: '🗂️', tags: 'files folder organize index' },
  { emoji: '📊', tags: 'chart bar graph data statistics' },
  { emoji: '📈', tags: 'graph trend analytics growth' },
  { emoji: '🗺️', tags: 'map geography explore plan' },
  { emoji: '🎯', tags: 'target goal aim focus' },
  { emoji: '✅', tags: 'check done complete task' },
  { emoji: '🎵', tags: 'music note audio sound' },
  { emoji: '🎨', tags: 'art paint design creative' },
  { emoji: '🎭', tags: 'theater drama arts performance' },
  { emoji: '🏆', tags: 'trophy win achievement award' },
  { emoji: '⚽', tags: 'football soccer sport ball' },
  { emoji: '🎲', tags: 'dice game random chance' },
  { emoji: '🧩', tags: 'puzzle piece problem solve logic' },
  { emoji: '🚀', tags: 'rocket space launch fast' },
  { emoji: '✈️', tags: 'plane travel fly aviation' },
  { emoji: '🌟', tags: 'star shine excellent special' },
  { emoji: '🔥', tags: 'fire hot trending energy' },
  { emoji: '💎', tags: 'diamond gem precious value' },
  { emoji: '🧮', tags: 'abacus math calculation count' },
  { emoji: '📡', tags: 'satellite antenna signal physics' },
  { emoji: '🔋', tags: 'battery energy power charge' },
  { emoji: '🧲', tags: 'magnet physics attract force' },
  { emoji: '⚡', tags: 'lightning electricity energy power' },
  { emoji: '🌡️', tags: 'thermometer temperature measure' },
  { emoji: '🗓️', tags: 'calendar schedule plan date' },
  { emoji: '⏱️', tags: 'stopwatch time measure speed' },
  { emoji: '🔐', tags: 'lock security safe protected' },
  { emoji: '🧭', tags: 'compass direction navigate explore' },
  { emoji: '📌', tags: 'pin location mark important' },
  { emoji: '🔖', tags: 'bookmark save mark reference' },
  { emoji: '📣', tags: 'megaphone announce important alert' },
  { emoji: '🌐', tags: 'globe web internet network world' },
  { emoji: '🧑‍💻', tags: 'developer programmer coder tech' },
  { emoji: '🧑‍🔬', tags: 'scientist researcher lab study' },
  { emoji: '🧑‍🏫', tags: 'teacher educator professor school' },
]

const COLOR_OPTIONS = [
  '#6d5ef6','#e8845a','#5ab58e','#e8c45a','#e8617a','#5ab5d4','#a78b5f','#8b5ef6',
]

type Topic = {
  id: number
  name: string
  desc: string
  mastery: number
  color: string
  cards: number
  notes: number
  lastStudied: string
  exam: string
  icon: string
}

const TOPIC_ICONS = ['📚', '🧬', '💊', '🔬', '🧠', '📝']

type TopicStats = { topic_id: number; total: number; due_today: number; retention_rate: number | null }
type AnalyticsTopic = { topicId: number; averageMastery: number | null }
type StudyGoal = { topicId: number; examDate: string | null }

function MasteryRing({ value, color, size = 44 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 4
  const circ = 2 * Math.PI * r
  const filled = (value / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0ece6" strokeWidth="3.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4.5} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{value}</text>
    </svg>
  )
}

function IconPicker({ current, color, onSelect, onClose }: { current: string; color: string; onSelect: (icon: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState('')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    // Auto-focus the search input when picker opens
    setTimeout(() => inputRef.current?.focus(), 40)
  }, [])

  const filtered = query.trim()
    ? ICON_CATALOG.filter(e =>
        e.tags.includes(query.toLowerCase()) ||
        e.emoji.includes(query)
      )
    : ICON_CATALOG

  const handleCustomKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && custom.trim()) {
      // grab first grapheme cluster (emoji or char)
      const first = [...custom.trim()][0]
      if (first) onSelect(first)
    }
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 300,
      background: 'var(--color-surface)', borderRadius: 14, border: '1px solid var(--color-border)',
      boxShadow: '0 12px 36px rgba(24,22,15,0.15)', padding: '12px',
      width: 264, marginTop: 6, boxSizing: 'border-box', overflow: 'hidden',
    }}>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-text-subtle)', pointerEvents: 'none' }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search icons…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8,
            borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e8e4de', fontSize: 13, color: 'var(--color-text)',
            outline: 'none', boxSizing: 'border-box', background: 'var(--color-bg)',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = color }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e8e4de' }}
        />
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3, maxHeight: 192, overflowY: 'auto', marginBottom: 10 }}>
        {filtered.length > 0 ? filtered.map(({ emoji: icon }) => (
          <button key={icon} onClick={() => onSelect(icon)} style={{
            width: 30, height: 30, borderRadius: 7, fontSize: 17, cursor: 'pointer',
            border: icon === current ? `2px solid ${color}` : '2px solid transparent',
            background: icon === current ? `${color}20` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s',
          }}
            onMouseEnter={e => { if (icon !== current) e.currentTarget.style.background = '#f0ece6' }}
            onMouseLeave={e => { if (icon !== current) e.currentTarget.style.background = 'none' }}
          >{icon}</button>
        )) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '18px 0', fontSize: 12, color: 'var(--color-text-subtle)' }}>No match — try the field below</div>
        )}
      </div>

      {/* Custom emoji input */}
      <div style={{ borderTop: '1px solid var(--color-border-soft)', paddingTop: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-subtle)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Or type / paste any emoji</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', boxSizing: 'border-box' }}>
          <input
            type="text"
            placeholder="e.g. 😀"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={handleCustomKey}
            maxLength={8}
            style={{
              flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 7,
              borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#e8e4de', fontSize: 15, outline: 'none',
              boxSizing: 'border-box', background: 'var(--color-bg)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = color }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e8e4de' }}
          />
          <button
            onClick={() => { const first = [...custom.trim()][0]; if (first) onSelect(first) }}
            disabled={!custom.trim()}
            style={{
              flexShrink: 0, padding: '7px 11px', borderRadius: 7, border: 'none',
              cursor: custom.trim() ? 'pointer' : 'default',
              background: custom.trim() ? color : '#d4cfc9',
              color: '#fff', fontSize: 12, fontWeight: 600,
              transition: 'background 0.15s',
            }}
          >Use</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 5 }}>Press Enter or click Use to apply</div>
      </div>
    </div>
  )
}

export default function Topics() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIcon, setNewIcon] = useState('📚')
  const [newColor, setNewColor] = useState('#6d5ef6')
  const [showNewIconPicker, setShowNewIconPicker] = useState(false)
  const [iconPickerForId, setIconPickerForId] = useState<number | null>(null)

  const loadTopics = async () => {
    setError('')
    try {
      const overview = await api<{
        analytics: { topics: AnalyticsTopic[] }
        flashcardsByTopic: TopicStats[]
        topics: ApiTopic[]
        goals: StudyGoal[]
        noteCounts: Record<string, number>
      }>('/dashboard/overview')
      const topicResult = { topics: overview.topics }
      const analytics = overview.analytics
      const cardStats = { stats: overview.flashcardsByTopic }
      const goals = { goals: overview.goals }
      setTopics(topicResult.topics.map((topic, index) => {
        const mastery = analytics.topics.find(entry => entry.topicId === topic.id)?.averageMastery
        const cards = cardStats.stats.find(entry => entry.topic_id === topic.id)
        const goal = goals.goals.find(entry => entry.topicId === topic.id)
        return {
          id: topic.id,
          name: topic.title,
          desc: topic.description || 'No description yet.',
          mastery: mastery == null ? 0 : Math.round(mastery * 100),
          color: COLOR_OPTIONS[index % COLOR_OPTIONS.length],
          cards: cards?.total ?? 0,
          notes: overview.noteCounts[String(topic.id)] ?? 0,
          lastStudied: new Date(topic.updated_at).toLocaleDateString(),
          exam: goal?.examDate ? new Date(goal.examDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—',
          icon: TOPIC_ICONS[index % TOPIC_ICONS.length],
        }
      }))
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTopics() }, [])

  const filtered = topics.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.desc.toLowerCase().includes(search.toLowerCase())
  )

  const changeTopicIcon = (id: number, icon: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, icon } : t))
    setIconPickerForId(null)
  }

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 4 }}>My topics</h1>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Your study subjects — each one a complete study system.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#5848d9' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#6d5ef6' }}
        >
          + New topic
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 15 }}>🔍</span>
        <input
          type="text" placeholder="Search topics..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 13.5, color: 'var(--color-text)', outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#6d5ef6' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e8e4de' }}
        />
      </div>

      {error && <div role="alert" style={{ marginBottom: 18, padding: '11px 14px', borderRadius: 10, background: 'var(--color-alert-red-bg)', color: '#d05a3e', fontSize: 13 }}>{error}</div>}

      {/* Topic cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '70px 24px', color: 'var(--color-text-muted)' }}>Loading your topics…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: 'var(--color-text)', marginBottom: 8 }}>No topics yet</h3>
          <p style={{ fontSize: 14, marginBottom: 24 }}>Create your first topic and start building your study system.</p>
          <button onClick={() => setShowCreate(true)} style={{ fontSize: 14, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 10, padding: '11px 22px', cursor: 'pointer' }}>Create your first topic</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {filtered.map((t) => (
            <div key={t.id}
              onClick={() => navigate(`/app/topics/${t.id}`)}
              style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', padding: '22px', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s', position: 'relative' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(24,22,15,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Icon — click to pick */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setIconPickerForId(prev => prev === t.id ? null : t.id) }}
                      title="Change icon"
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: `${t.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, borderWidth: 2, borderStyle: 'solid', borderColor: 'transparent', cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.background = `${t.color}28` }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = `${t.color}18` }}
                    >
                      {t.icon}
                      <span style={{
                        position: 'absolute', bottom: -3, right: -3, width: 14, height: 14,
                        borderRadius: '50%', background: 'var(--color-surface)', border: `1.5px solid ${t.color}`,
                        fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: t.color, fontWeight: 700, lineHeight: 1,
                      }}>✎</span>
                    </button>

                    {iconPickerForId === t.id && (
                      <div onClick={e => e.stopPropagation()}>
                        <IconPicker
                          current={t.icon}
                          color={t.color}
                          onSelect={icon => changeTopicIcon(t.id, icon)}
                          onClose={() => setIconPickerForId(null)}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 2 }}>Last studied {t.lastStudied}</div>
                  </div>
                </div>
                <MasteryRing value={t.mastery} color={t.color} size={44} />
              </div>

              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-2)', marginBottom: 16 }}>{t.desc}</p>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}><strong style={{ color: 'var(--color-text-2)' }}>{t.cards}</strong> cards</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}><strong style={{ color: 'var(--color-text-2)' }}>{t.notes}</strong> notes</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Exam <strong style={{ color: 'var(--color-text-2)' }}>{t.exam}</strong></div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Tutor','Flashcards','Quizzes','Graph'].map(tool => (
                  <span key={tool} style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-2)', background: 'var(--color-bg)', borderRadius: 6, padding: '3px 8px', border: '1px solid var(--color-border)' }}>{tool}</span>
                ))}
              </div>
            </div>
          ))}

          {/* Add new card */}
          <div onClick={() => setShowCreate(true)} style={{ background: 'transparent', borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d4cfc9', padding: '22px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 10, transition: 'border-color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6d5ef6'; e.currentTarget.style.background = '#faf9ff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d4cfc9'; e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ fontSize: 28 }}>+</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-2)' }}>New topic</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', textAlign: 'center' }}>Upload notes or type to get started</div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(24,22,15,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowCreate(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 18, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(24,22,15,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>New topic</div>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 24 }}>Create a study topic</h2>

            {/* Icon + color row */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', display: 'block', marginBottom: 8 }}>Icon & color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Icon preview + picker trigger */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowNewIconPicker(p => !p)}
                    style={{
                      width: 52, height: 52, borderRadius: 13, fontSize: 24,
                      background: `${newColor}18`, border: `2px solid ${newColor}44`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'border-color 0.15s',
                    }}
                  >{newIcon}</button>

                  {showNewIconPicker && (
                    <IconPicker
                      current={newIcon}
                      color={newColor}
                      onSelect={icon => { setNewIcon(icon); setShowNewIconPicker(false) }}
                      onClose={() => setShowNewIconPicker(false)}
                    />
                  )}
                </div>

                {/* Color swatches */}
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} type="button" onClick={() => setNewColor(c)} style={{
                      width: 26, height: 26, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', outline: newColor === c ? `3px solid ${c}` : '3px solid transparent',
                      outlineOffset: 2, transition: 'outline 0.12s',
                    }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', display: 'block', marginBottom: 6 }}>Topic name</label>
              <input type="text" placeholder="e.g. Organic Chemistry" value={newName} onChange={e => setNewName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--color-border)', fontSize: 14, color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6d5ef6' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e4de' }}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', display: 'block', marginBottom: 6 }}>Short description (optional)</label>
              <textarea placeholder="What is this topic about?" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--color-border)', fontSize: 14, color: 'var(--color-text)', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6d5ef6' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e4de' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-2)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 18px', cursor: 'pointer' }}>Cancel</button>
              <button
                disabled={creating}
                onClick={async () => {
                  if (!newName.trim()) return
                  setCreating(true)
                  setError('')
                  try {
                    const result = await api<{ topic: ApiTopic }>('/topics', {
                      method: 'POST',
                      body: JSON.stringify({ title: newName.trim(), description: newDesc.trim() || null }),
                    })
                    setTopics(prev => [...prev, {
                      id: result.topic.id, name: result.topic.title,
                      desc: result.topic.description || 'No description yet.',
                      mastery: 0, color: newColor, cards: 0, notes: 0,
                      lastStudied: 'Never', exam: '—', icon: newIcon,
                    }])
                    setShowCreate(false); setNewName(''); setNewDesc(''); setNewIcon('📚'); setNewColor('#6d5ef6')
                  } catch (requestError) {
                    setError(messageFromError(requestError))
                  } finally {
                    setCreating(false)
                  }
                }}
                style={{ fontSize: 14, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: creating ? 'wait' : 'pointer', opacity: creating ? .7 : 1 }}
              >{creating ? 'Creating…' : 'Create topic'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
