'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '../lib/navigation'
import { api, messageFromError, type Topic } from '../lib/api'

type Task = { id: number; topicId: number; conceptId: number | null; title: string; estimatedMinutes: number; orderIndex: number; status: 'pending' | 'completed' | 'skipped' }
type Plan = { id: number; planDate: string; narrative: string; tasks: Task[] }
type Goal = { topicId: number; examDate: string | null; availableMinutesPerDay: number | null }
type Prediction = { topicId: number; topicTitle: string; examDate: string | null; status: string; readiness: number | null; daysRemaining: number | null; narrative: string }

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  on_track: { label: 'On track', bg: 'rgba(109,94,246,.16)', color: '#8f83ff' },
  at_risk: { label: 'At risk', bg: 'rgba(232,132,90,.16)', color: '#e8845a' },
  behind: { label: 'Behind', bg: 'rgba(208,90,62,.16)', color: '#d05a3e' },
  no_data: { label: 'No data', bg: 'var(--color-surface-2)', color: 'var(--color-text-muted)' },
  no_deadline: { label: 'No deadline', bg: 'var(--color-surface-2)', color: 'var(--color-text-muted)' },
}

export default function Coach() {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [examDate, setExamDate] = useState('')
  const [dailyTime, setDailyTime] = useState(60)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setError('')
    try {
      const [planResult, topicResult, goalResult, predictionResult] = await Promise.all([
        api<Plan>('/coach/plan/today'),
        api<{ topics: Topic[] }>('/topics'),
        api<{ goals: Goal[] }>('/coach/goals'),
        api<{ predictions: Prediction[] }>('/goal-predictions'),
      ])
      setPlan(planResult)
      setTopics(topicResult.topics)
      setGoals(goalResult.goals)
      setPredictions(predictionResult.predictions)
      const firstTopicId = selectedTopicId || String(goalResult.goals[0]?.topicId ?? topicResult.topics[0]?.id ?? '')
      setSelectedTopicId(firstTopicId)
      const goal = goalResult.goals.find(item => String(item.topicId) === firstTopicId)
      setExamDate(goal?.examDate ?? '')
      setDailyTime(goal?.availableMinutesPerDay ?? 60)
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setLoading(false)
    }
  }, [selectedTopicId])

  useEffect(() => { void loadData() }, [])

  const titleById = useMemo(() => new Map(topics.map(topic => [topic.id, topic.title])), [topics])
  const done = plan?.tasks.filter(task => task.status === 'completed').length ?? 0
  const total = plan?.tasks.length ?? 0
  const remainingMinutes = plan?.tasks.filter(task => task.status !== 'completed').reduce((sum, task) => sum + task.estimatedMinutes, 0) ?? 0

  const selectTopic = (value: string) => {
    setSelectedTopicId(value)
    const goal = goals.find(item => String(item.topicId) === value)
    setExamDate(goal?.examDate ?? '')
    setDailyTime(goal?.availableMinutesPerDay ?? 60)
  }

  const toggleTask = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
    setPlan(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, status: nextStatus } : item) } : current)
    try {
      await api(`/study-plan-tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) })
    } catch (requestError) {
      setPlan(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id ? task : item) } : current)
      setError(messageFromError(requestError))
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    setError('')
    try { setPlan(await api<Plan>('/coach/plan/regenerate', { method: 'POST' })) }
    catch (requestError) { setError(messageFromError(requestError)) }
    finally { setRegenerating(false) }
  }

  const saveGoal = async () => {
    if (!selectedTopicId) return
    setSaving(true)
    setError('')
    try {
      const goal = await api<Goal>(`/topics/${selectedTopicId}/study-goal`, {
        method: 'PUT', body: JSON.stringify({ examDate: examDate || null, availableMinutesPerDay: dailyTime }),
      })
      setGoals(current => [...current.filter(item => item.topicId !== goal.topicId), goal])
      const prediction = await api<Prediction>(`/topics/${selectedTopicId}/goal-prediction`)
      setPredictions(current => [...current.filter(item => item.topicId !== prediction.topicId), prediction])
    } catch (requestError) { setError(messageFromError(requestError)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1020, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Study Coach</h1>
        <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Your personalised daily plan, built from your real mastery data.</p>
      </div>
      {error && <div role="alert" style={{ marginBottom: 18, padding: '11px 14px', borderRadius: 10, background: 'var(--color-alert-red-bg)', color: '#d05a3e', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-soft)', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Today's study plan</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>{done}/{total} tasks done · {remainingMinutes} min remaining</div>
            </div>
            <button disabled={regenerating} onClick={() => void regenerate()} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-2)', cursor: regenerating ? 'wait' : 'pointer' }}>{regenerating ? 'Regenerating…' : 'Regenerate'}</button>
          </div>
          <div style={{ height: 3, background: 'var(--color-surface-2)' }}><div style={{ height: '100%', width: `${total ? done / total * 100 : 0}%`, background: '#6d5ef6' }} /></div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading your plan…</div> : !plan?.tasks.length ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>{plan?.narrative || 'No tasks for today. Add an exam goal or study content to generate a plan.'}</div>
            ) : plan.tasks.map(task => {
              const complete = task.status === 'completed'
              return <div key={task.id} style={{ display: 'flex', gap: 12, padding: 13, borderRadius: 11, border: '1px solid var(--color-border-soft)', background: complete ? 'var(--color-surface-2)' : 'var(--color-surface)', opacity: complete ? .7 : 1 }}>
                <button onClick={() => void toggleTask(task)} style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${complete ? '#5ab58e' : 'var(--color-border)'}`, background: complete ? '#5ab58e' : 'transparent', color: '#fff', cursor: 'pointer' }}>{complete ? '✓' : ''}</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{titleById.get(task.topicId) || 'Study topic'}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', textDecoration: complete ? 'line-through' : 'none' }}>{task.title}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 7 }}>~{task.estimatedMinutes} min</div>
                  {!complete && <button onClick={() => navigate(`/app/topics/${task.topicId}`)} style={{ border: 'none', borderRadius: 7, padding: '5px 10px', background: 'rgba(109,94,246,.16)', color: '#8f83ff', cursor: 'pointer', fontWeight: 600 }}>Start →</button>}
                </div>
              </div>
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-soft)', fontWeight: 700, color: 'var(--color-text)' }}>Exam readiness</div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!predictions.length ? <div style={{ padding: 18, color: 'var(--color-text-muted)', fontSize: 13 }}>Set an exam date to see readiness predictions.</div> : predictions.map(prediction => {
                const meta = STATUS_META[prediction.status] ?? STATUS_META.no_data
                const mastery = Math.round((prediction.readiness ?? 0) * 100)
                return <div key={prediction.topicId} style={{ background: meta.bg, borderRadius: 11, padding: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}><strong style={{ fontSize: 12.5, color: 'var(--color-text)' }}>📚 {prediction.topicTitle}</strong><span style={{ color: meta.color, fontSize: 11, fontWeight: 700 }}>{meta.label}</span></div>
                  <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 4, marginBottom: 8 }}><div style={{ height: '100%', width: `${mastery}%`, background: meta.color, borderRadius: 4 }} /></div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-text-2)' }}>{prediction.narrative}</div>
                  {prediction.examDate && <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--color-text-muted)' }}>{new Date(prediction.examDate).toLocaleDateString()} · {prediction.daysRemaining ?? 0} days left</div>}
                </div>
              })}
            </div>
          </div>

          <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>Study settings</div>
            {!topics.length ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Create a topic first.</div> : <>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Topic</label>
              <select value={selectedTopicId} onChange={event => selectTopic(event.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', marginBottom: 13 }}>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Target exam date</label>
              <input type="date" value={examDate} onChange={event => setExamDate(event.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', marginBottom: 13 }} />
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Daily study time: <strong>{dailyTime} min</strong></label>
              <input type="range" min={15} max={240} step={15} value={dailyTime} onChange={event => setDailyTime(Number(event.target.value))} style={{ width: '100%', accentColor: '#6d5ef6' }} />
              <button disabled={saving} onClick={() => void saveGoal()} style={{ width: '100%', marginTop: 14, padding: 10, borderRadius: 9, border: 'none', background: '#6d5ef6', color: '#fff', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving…' : 'Save settings'}</button>
            </>}
          </div>
        </div>
      </div>
      <style>{`@media(max-width:860px){div[style*="grid-template-columns: 1fr 320px"]{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
