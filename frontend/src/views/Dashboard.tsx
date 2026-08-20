'use client'
import { useEffect, useState } from 'react'
import { useNavigate } from '../lib/navigation'
import { api, messageFromError, type Topic as ApiTopic } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

type AnalyticsOverview = {
  activitiesThisWeek: number
  currentStreak: number
  mastery: { averageMastery: number | null }
  weakestConcepts: Array<{ conceptName: string; topicTitle: string; masteryScore: number }>
  topics: Array<{ topicId: number; title: string; averageMastery: number | null }>
}
type FlashStats = { due_today: number; retention_rate: number | null }
type TopicFlashStats = { topic_id: number; total: number; due_today: number }
type Plan = { narrative: string; tasks: Array<{ id: number; topicId: number; title: string; estimatedMinutes: number; status: string }> }
type StudyGoal = { topicId: number; examDate: string | null; availableMinutesPerDay: number | null }
type DashboardResponse = {
  analytics: AnalyticsOverview
  flashcards: FlashStats
  flashcardsByTopic: TopicFlashStats[]
  topics: ApiTopic[]
  todayPlan: Plan
  goals: StudyGoal[]
}

function MasteryBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 5, background: 'var(--color-border-soft)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [flashStats, setFlashStats] = useState<FlashStats>({ due_today: 0, retention_rate: null })
  const [topics, setTopics] = useState<Array<{ id: number; name: string; mastery: number; color: string; cards: number }>>([])
  const [todayTasks, setTodayTasks] = useState<Array<{ topic: string; task: string; link: string; time: string; done: boolean }>>([])
  const [goals, setGoals] = useState<StudyGoal[]>([])
  const [error, setError] = useState('')
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    let active = true
    api<DashboardResponse>('/dashboard/overview').then(result => {
      if (!active) return
      const { analytics, flashcards: summary, flashcardsByTopic, topics: topicList, todayPlan: plan, goals: goalList } = result
      const colors = ['#6d5ef6', '#e8845a', '#5ab58e', '#e8c45a', '#5ab5d4']
      setOverview(analytics)
      setFlashStats(summary)
      setGoals(goalList)
      setTopics(topicList.map((topic, index) => ({
        id: topic.id,
        name: topic.title,
        mastery: Math.round((analytics.topics.find(item => item.topicId === topic.id)?.averageMastery ?? 0) * 100),
        color: colors[index % colors.length],
        cards: flashcardsByTopic.find(item => item.topic_id === topic.id)?.total ?? 0,
      })))
      const titles = new Map(topicList.map(topic => [topic.id, topic.title]))
      setTodayTasks(plan.tasks.map(task => ({
        topic: titles.get(task.topicId) ?? 'Study plan', task: task.title,
        link: `/app/topics/${task.topicId}`, time: `~${task.estimatedMinutes} min`, done: task.status === 'completed',
      })))
    }).catch(requestError => { if (active) setError(messageFromError(requestError)) })
    return () => { active = false }
  }, [])

  const needsAttention = [
    ...(overview?.weakestConcepts ?? []).slice(0, 2).map(item => ({
      label: `${item.topicTitle}: ${item.conceptName}`, type: `Mastery ${Math.round(item.masteryScore * 100)}%`,
      color: '#e8845a', bgVar: 'var(--color-alert-warm-bg)', action: 'Study now', path: '/app/flashcards',
    })),
    ...(flashStats.due_today > 0 ? [{ label: `${flashStats.due_today} cards due`, type: 'Due reviews', color: '#c04a2b', bgVar: 'var(--color-alert-red-bg)', action: 'Start review', path: '/app/flashcards/review' }] : []),
  ]
  const upcomingGoal = goals
    .filter(goal => goal.examDate && new Date(goal.examDate).getTime() >= Date.now())
    .sort((a, b) => new Date(a.examDate!).getTime() - new Date(b.examDate!).getTime())[0]
  const upcomingTopic = topics.find(topic => topic.id === upcomingGoal?.topicId)
  const daysLeft = upcomingGoal?.examDate
    ? Math.max(0, Math.ceil((new Date(upcomingGoal.examDate).getTime() - Date.now()) / 86_400_000))
    : 0

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1040, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>{greeting}, {user?.name || 'Student'} 👋</p>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>Your overview</h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Day streak', value: String(overview?.currentStreak ?? 0), sub: 'Keep it up!', icon: '🔥', color: '#e8845a' },
          { label: 'Cards due', value: String(flashStats.due_today), sub: 'today', icon: '🃏', color: '#6d5ef6' },
          { label: 'Avg. mastery', value: `${Math.round((overview?.mastery.averageMastery ?? 0) * 100)}%`, sub: `across ${topics.length} topics`, icon: '📊', color: '#5ab58e' },
          { label: 'Activities', value: String(overview?.activitiesThisWeek ?? 0), sub: 'this week', icon: '⏱', color: 'var(--color-text-muted)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '18px 18px 14px', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 500, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {error && <div role="alert" style={{ marginBottom: 20, padding: '11px 14px', borderRadius: 10, background: 'var(--color-alert-red-bg)', color: '#d05a3e', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Needs attention */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Needs your attention</h2>
            </div>
            <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {needsAttention.length === 0 ? <div style={{ padding: 12, color: 'var(--color-text-muted)', fontSize: 13 }}>Nothing needs urgent attention.</div> : needsAttention.map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: n.bgVar, borderRadius: 10, padding: '10px 14px', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: n.color }}>{n.type}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 2 }}>{n.label}</div>
                  </div>
                  <button
                    onClick={() => navigate(n.path)}
                    style={{ fontSize: 12, fontWeight: 600, color: n.color, background: 'none', border: `1px solid ${n.color}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.12s, color 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = n.color; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = n.color }}
                  >
                    {n.action}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-soft)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Your topics</h2>
              <button onClick={() => navigate('/app/topics')} style={{ fontSize: 12, color: '#6d5ef6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>View all →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topics.length === 0 ? <div style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Create a topic to begin studying.</div> : topics.map((t, i) => (
                <div key={i}
                  onClick={() => navigate(`/app/topics/${t.id}`)}
                  style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', borderBottom: i < topics.length - 1 ? '1px solid var(--color-border-soft)' : 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {['📚','🧬','💊','🔬','🧠'][i % 5]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{t.name}</div>
                    <MasteryBar value={t.mastery} color={t.color} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: t.color }}>{t.mastery}%</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.cards} cards</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Today's plan */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Today's plan</h2>
              <button onClick={() => navigate('/app/coach')} style={{ fontSize: 12, color: '#6d5ef6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Full plan →</button>
            </div>
            <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayTasks.length === 0 ? <div style={{ padding: 10, color: 'var(--color-text-muted)', fontSize: 13 }}>No tasks planned for today.</div> : todayTasks.map((t, i) => (
                <div key={i}
                  onClick={() => navigate(t.link)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px', borderRadius: 10, cursor: 'pointer', opacity: t.done ? 0.55 : 1, transition: 'background 0.12s', background: t.done ? 'var(--color-surface-2)' : 'var(--color-surface)', border: '1px solid var(--color-border-soft)' }}
                  onMouseEnter={e => { if (!t.done) e.currentTarget.style.background = 'var(--color-surface-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = t.done ? 'var(--color-surface-2)' : 'var(--color-surface)' }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${t.done ? '#5ab58e' : 'var(--color-border)'}`, background: t.done ? '#5ab58e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {t.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>{t.topic}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.task}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 3 }}>{t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exam countdown */}
          <div style={{ background: 'linear-gradient(145deg, #1c1830 0%, #18160f 60%)', borderRadius: 18, padding: '22px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 32px rgba(109,94,246,0.18)' }}>
            <div style={{ position: 'absolute', top: -28, right: -28, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,94,246,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 70, height: 70, borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,181,142,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6d5ef6', boxShadow: '0 0 6px rgba(109,94,246,0.8)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9b8fff', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Upcoming exam</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 4 }}>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 52, fontWeight: 700, color: '#f7f5f1', lineHeight: 1, letterSpacing: '-0.03em' }}>{daysLeft}</div>
              <div style={{ paddingBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(247,245,241,0.5)', lineHeight: 1.3 }}>days</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(247,245,241,0.5)', lineHeight: 1.3 }}>left</div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(247,245,241,0.4)', marginBottom: 18 }}>{upcomingTopic?.name || 'No upcoming exam configured'}</div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topics.slice(0, 4).map((topic, i) => {
                const status = topic.mastery >= 75 ? 'Strong' : topic.mastery >= 50 ? 'On track' : 'At risk'
                const color = topic.mastery >= 75 ? '#5ab58e' : topic.mastery >= 50 ? '#6d5ef6' : '#e8845a'
                return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: 'rgba(247,245,241,0.55)', fontWeight: 400 }}>{topic.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}20`, borderRadius: 5, padding: '2px 8px' }}>{status}</span>
                </div>
              )})}
            </div>
            <button onClick={() => navigate('/app/coach')}
              style={{ marginTop: 18, width: '100%', background: 'rgba(109,94,246,0.18)', borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(109,94,246,0.35)', borderRadius: 10, padding: '10px', fontSize: 12.5, fontWeight: 600, color: '#b3a9ff', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,94,246,0.28)'; e.currentTarget.style.borderColor = 'rgba(109,94,246,0.55)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,94,246,0.18)'; e.currentTarget.style.borderColor = 'rgba(109,94,246,0.35)' }}
            >
              View readiness forecast
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>

          {/* Quick actions */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Quick actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Review cards', icon: '🃏', path: '/app/flashcards/review' },
                { label: 'Take a quiz', icon: '📝', path: '/app/quizzes' },
                { label: 'Ask tutor', icon: '💬', path: '/app/ai-tutor' },
                { label: 'View mistakes', icon: '📖', path: '/app/mistakes' },
              ].map((a, i) => (
                <button key={i} onClick={() => navigate(a.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px', borderRadius: 9, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--color-border)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-2)', transition: 'background 0.12s, border-color 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#ede9ff'; e.currentTarget.style.borderColor = '#c5bcfa'; e.currentTarget.style.color = '#6d5ef6' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface-2)'; e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-2)' }}
                >
                  <span style={{ fontSize: 15 }}>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="grid-template-columns: 1fr 360px"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 540px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
