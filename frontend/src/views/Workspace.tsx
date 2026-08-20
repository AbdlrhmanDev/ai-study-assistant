'use client'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '../lib/navigation'
import { api, messageFromError, type Topic } from '../lib/api'

type WorkspacePage = {
  id: number
  topic_id: number | null
  title: string
  blocks: unknown[]
  created_at: string
  updated_at: string
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

export default function Workspace() {
  const navigate = useNavigate()
  const [pages, setPages] = useState<WorkspacePage[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [topicId, setTopicId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      api<{ pages: WorkspacePage[] }>('/workspace-pages', { cache: 'no-store' }),
      api<{ topics: Topic[] }>('/topics'),
    ]).then(([pageResult, topicResult]) => {
      if (!active) return
      setPages(pageResult.pages)
      setTopics(topicResult.topics)
    }).catch(requestError => { if (active) setError(messageFromError(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => pages.filter(page =>
    page.title.toLowerCase().includes(search.trim().toLowerCase())
  ), [pages, search])

  const openPage = (id: number) => navigate(`/app/workspace/page?id=${id}`)

  const createPage = async () => {
    const title = newTitle.trim()
    if (!title || creating) return
    setCreating(true)
    setError('')
    try {
      const result = await api<{ page: WorkspacePage }>('/workspace-pages', {
        method: 'POST',
        body: JSON.stringify({ title, topic_id: topicId ? Number(topicId) : null }),
      })
      setPages(current => [result.page, ...current])
      setShowCreate(false)
      setNewTitle('')
      setTopicId('')
      openPage(result.page.id)
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="ws-root" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div className="ws-list" style={{ width: 300, borderRight: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>Workspace</span>
            <button onClick={() => setShowCreate(true)} aria-label="New page" style={{ width: 34, height: 34, borderRadius: 9, background: '#6d5ef6', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 19 }}>+</button>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)', fontSize: 13 }}>🔍</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search pages…" style={{ width: '100%', padding: '10px 10px 10px 34px', borderRadius: 9, border: '1px solid var(--color-border)', fontSize: 13.5, color: 'var(--color-text)', outline: 'none', background: 'var(--color-bg)', boxSizing: 'border-box' }} />
          </div>
          {error && <div role="alert" style={{ marginTop: 10, padding: 9, borderRadius: 8, background: 'var(--color-alert-red-bg)', color: '#d05a3e', fontSize: 12 }}>{error}</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 80px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading pages…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '44px 16px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>📝</div>
              <div style={{ fontSize: 13.5 }}>{search ? 'No pages match your search' : 'No workspace pages yet'}</div>
            </div>
          ) : filtered.map(page => (
            <button key={page.id} onClick={() => openPage(page.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 10px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--color-text)' }}
              onMouseEnter={event => { event.currentTarget.style.background = 'var(--color-bg)' }}
              onMouseLeave={event => { event.currentTarget.style.background = 'transparent' }}>
              <span style={{ fontSize: 18 }}>📝</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.title}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-subtle)', marginTop: 3 }}>{relativeTime(page.updated_at)}</span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => setShowCreate(true)} style={{ width: '100%', padding: 11, borderRadius: 9, background: 'none', border: '1.5px dashed var(--color-border)', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 13.5 }}>+ New page</button>
        </div>
      </div>

      <div className="ws-empty" style={{ flex: 1, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 32 }}>
        <div style={{ fontSize: 52 }}>📝</div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, color: 'var(--color-text)' }}>{pages.length ? 'Select a page to open it' : 'Create your first page'}</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 330, textAlign: 'center', lineHeight: 1.6 }}>Your workspace pages are saved in your account and can be linked to a study topic.</div>
        {!loading && pages.length === 0 && <button onClick={() => setShowCreate(true)} style={{ marginTop: 8, padding: '12px 22px', borderRadius: 10, border: 'none', background: '#6d5ef6', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Create page</button>}
      </div>

      {showCreate && (
        <div onClick={() => !creating && setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(24,22,15,.5)' }}>
          <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 420, padding: 28, borderRadius: 18, background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', textTransform: 'uppercase', letterSpacing: '.08em' }}>New page</div>
            <h2 style={{ margin: '6px 0 20px', fontFamily: "'Fraunces', Georgia, serif", color: 'var(--color-text)', fontSize: 21 }}>Create a workspace page</h2>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Page title</label>
            <input autoFocus value={newTitle} onChange={event => setNewTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void createPage() }} placeholder="Untitled" style={{ width: '100%', padding: '11px 12px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', outline: 'none', marginBottom: 16 }} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Link to topic (optional)</label>
            <select value={topicId} onChange={event => setTopicId(event.target.value)} style={{ width: '100%', padding: '11px 12px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box', marginBottom: 22 }}>
              <option value="">No topic link</option>
              {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button disabled={creating} onClick={() => setShowCreate(false)} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-2)', cursor: 'pointer' }}>Cancel</button>
              <button disabled={!newTitle.trim() || creating} onClick={() => void createPage()} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#6d5ef6', color: '#fff', fontWeight: 600, cursor: creating ? 'wait' : 'pointer', opacity: !newTitle.trim() || creating ? .6 : 1 }}>{creating ? 'Creating…' : 'Create page'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@media (max-width:900px){.ws-root{height:auto!important}.ws-list{width:100%!important;min-height:calc(100vh - 120px);border-right:none!important}.ws-empty{display:none!important}}`}</style>
    </div>
  )
}
