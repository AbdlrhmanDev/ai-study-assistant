'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from '../lib/navigation'
import { useSearchParams } from 'next/navigation'
import { api, messageFromError, type Topic as ApiTopic } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType =
  | 'p' | 'h1' | 'h2' | 'h3'
  | 'ul' | 'ol' | 'todo'
  | 'quote' | 'callout' | 'code' | 'divider' | 'toggle'

interface Block {
  id: string
  type: BlockType
  content: string
  checked?: boolean
  collapsed?: boolean
  color?: string
}

type ApiBlock = { id: string; type: string; content: string; properties?: { checked?: boolean | null; backgroundColor?: string | null }; children?: ApiBlock[] }
type ApiPage = { id: number; topic_id: number | null; title: string; blocks: ApiBlock[]; created_at: string; updated_at: string }

const apiToLocalType: Record<string, BlockType> = {
  text: 'p', heading_1: 'h1', heading_2: 'h2', heading_3: 'h3', heading_4: 'h3',
  bulleted_list_item: 'ul', numbered_list_item: 'ol', todo: 'todo', quote: 'quote',
  callout: 'callout', code: 'code', divider: 'divider', toggle: 'toggle',
}
const localToApiType: Record<BlockType, string> = {
  p: 'text', h1: 'heading_1', h2: 'heading_2', h3: 'heading_3', ul: 'bulleted_list_item',
  ol: 'numbered_list_item', todo: 'todo', quote: 'quote', callout: 'callout', code: 'code',
  divider: 'divider', toggle: 'toggle',
}

const fromApiBlock = (block: ApiBlock): Block => ({
  id: block.id, type: apiToLocalType[block.type] ?? 'p', content: block.content,
  checked: block.properties?.checked ?? false,
})
const toApiBlock = (block: Block) => ({
  id: block.id, type: localToApiType[block.type], content: block.content,
  properties: { checked: block.type === 'todo' ? Boolean(block.checked) : null }, children: [],
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9)

const BLOCK_MENU: { type: BlockType; label: string; icon: string; hint: string }[] = [
  { type: 'p',       label: 'Paragraph',     icon: '¶',  hint: 'Plain text' },
  { type: 'h1',      label: 'Heading 1',     icon: 'H1', hint: 'Large heading' },
  { type: 'h2',      label: 'Heading 2',     icon: 'H2', hint: 'Medium heading' },
  { type: 'h3',      label: 'Heading 3',     icon: 'H3', hint: 'Small heading' },
  { type: 'ul',      label: 'Bullet list',   icon: '•',  hint: 'Unordered list' },
  { type: 'ol',      label: 'Numbered list', icon: '1.',  hint: 'Ordered list' },
  { type: 'todo',    label: 'To-do',         icon: '☐',  hint: 'Checkbox item' },
  { type: 'toggle',  label: 'Toggle',        icon: '▸',  hint: 'Collapsible section' },
  { type: 'quote',   label: 'Quote',         icon: '"',  hint: 'Block quotation' },
  { type: 'callout', label: 'Callout',       icon: '💡', hint: 'Highlighted note' },
  { type: 'code',    label: 'Code block',    icon: '</>',hint: 'Monospaced code' },
  { type: 'divider', label: 'Divider',       icon: '—',  hint: 'Horizontal rule' },
]

// ─── Block renderer ───────────────────────────────────────────────────────────

function BlockRenderer({
  block,
  focused,
  showSlash,
  slashQuery,
  filteredMenu,
  menuIdx,
  aiPopover,
  onFocus,
  onInput,
  onKeyDown,
  onToggleCheck,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onDelete,
  onChangeType,
  onAIAction,
  onCloseAI,
}: {
  block: Block
  focused: boolean
  showSlash: boolean
  slashQuery: string
  filteredMenu: typeof BLOCK_MENU
  menuIdx: number
  aiPopover: boolean
  onFocus: () => void
  onInput: (text: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onToggleCheck: () => void
  onToggleCollapse: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onChangeType: (t: BlockType) => void
  onAIAction: (action: string) => void
  onCloseAI: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [focused])

  const textStyle: React.CSSProperties = {
    outline: 'none',
    width: '100%',
    wordBreak: 'break-word',
    minHeight: '1.5em',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
  }

  const editable = (extraStyle?: React.CSSProperties, placeholder = 'Type something, or / for commands…') => (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={block.content === '' ? placeholder : ''}
      style={{ ...textStyle, ...extraStyle }}
      onFocus={onFocus}
      onInput={e => onInput((e.target as HTMLDivElement).innerText)}
      onKeyDown={onKeyDown}
    >
      {block.content}
    </div>
  )

  const wrapRow = (child: React.ReactNode) => (
    <div className="block-row" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', position: 'relative' }}>
      {/* Handle */}
      <div className="block-handle" style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 3, flexShrink: 0 }}>
        <button onClick={onMoveUp} title="Move up" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-subtle)', fontSize: 10, padding: '1px 3px', lineHeight: 1 }}>▲</button>
        <button onClick={onMoveDown} title="Move down" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-subtle)', fontSize: 10, padding: '1px 3px', lineHeight: 1 }}>▼</button>
        <button onClick={onDelete} title="Delete block" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-subtle)', fontSize: 10, padding: '1px 3px', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {child}

        {/* Slash command menu */}
        {showSlash && focused && filteredMenu.length > 0 && (
          <div className="slash-menu" style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)',
            boxShadow: '0 8px 28px rgba(24,22,15,0.12)', width: 260,
            padding: '6px', marginTop: 4,
          }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-subtle)', padding: '4px 8px 6px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {slashQuery ? `/${slashQuery}` : 'Block types'}
            </div>
            {filteredMenu.map((m, i) => (
              <button key={m.type} onClick={() => onChangeType(m.type)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 10px',
                background: i === menuIdx ? '#ede9ff' : 'none', border: 'none', borderRadius: 8,
                cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-text-2)', flexShrink: 0 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.hint}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Ask AI popover */}
        {aiPopover && focused && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 100,
            background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)',
            boxShadow: '0 8px 28px rgba(24,22,15,0.12)', width: 220,
            padding: '8px', marginTop: 4,
          }}>
            <div style={{ fontSize: 11, color: '#6d5ef6', padding: '3px 8px 8px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>✦ Ask AI</div>
            {['Explain this', 'Simplify', 'Expand with examples', 'Make a flashcard', 'Translate to plain English'].map(action => (
              <button key={action} onClick={() => onAIAction(action)} style={{ display: 'block', width: '100%', padding: '7px 10px', background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--color-text)' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#ede9ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >{action}</button>
            ))}
            <button onClick={onCloseAI} style={{ display: 'block', width: '100%', padding: '6px 10px', background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--color-text-subtle)' }}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  )

  if (block.type === 'divider') {
    return (
      <div className="block-row" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
        <div className="block-handle" style={{ flexShrink: 0, width: 48 }} />
        <hr style={{ flex: 1, borderTop: '1.5px solid var(--color-border)', borderLeft: 0, borderRight: 0, borderBottom: 0, margin: 0 }} />
      </div>
    )
  }

  if (block.type === 'h1') return wrapRow(editable({ fontSize: 28, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }, 'Heading 1'))
  if (block.type === 'h2') return wrapRow(editable({ fontSize: 20, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em', lineHeight: 1.3 }, 'Heading 2'))
  if (block.type === 'h3') return wrapRow(editable({ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }, 'Heading 3'))

  if (block.type === 'ul') return wrapRow(
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ fontSize: 16, color: '#6d5ef6', lineHeight: 1.7, flexShrink: 0, marginTop: 2 }}>•</span>
      {editable({ fontSize: 14.5, color: 'var(--color-text)' })}
    </div>
  )

  if (block.type === 'ol') return wrapRow(
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.9, flexShrink: 0, fontWeight: 600, minWidth: 16 }}>1.</span>
      {editable({ fontSize: 14.5, color: 'var(--color-text)' })}
    </div>
  )

  if (block.type === 'todo') return wrapRow(
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <button onClick={onToggleCheck} style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${block.checked ? '#6d5ef6' : '#d4cfc9'}`, background: block.checked ? '#6d5ef6' : 'transparent', flexShrink: 0, cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        {block.checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
      </button>
      {editable({ fontSize: 14.5, color: block.checked ? 'var(--color-text-subtle)' : 'var(--color-text)', textDecoration: block.checked ? 'line-through' : 'none' }, 'To-do item')}
    </div>
  )

  if (block.type === 'toggle') return wrapRow(
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <button onClick={onToggleCollapse} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6d5ef6', fontSize: 13, padding: '2px 0', marginTop: 3, transition: 'transform 0.15s', transform: block.collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>▸</button>
        {editable({ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)' }, 'Toggle heading')}
      </div>
      {!block.collapsed && (
        <div style={{ marginLeft: 24, marginTop: 4, fontSize: 14, color: 'var(--color-text-2)', fontStyle: 'italic' }}>Click ▸ to collapse. Add content blocks below.</div>
      )}
    </div>
  )

  if (block.type === 'quote') return wrapRow(
    <div style={{ borderLeft: '3px solid #6d5ef6', paddingLeft: 16 }}>
      {editable({ fontSize: 15, color: 'var(--color-text-2)', fontStyle: 'italic', fontFamily: "'Fraunces', Georgia, serif", lineHeight: 1.65 }, 'Quote…')}
    </div>
  )

  if (block.type === 'callout') return wrapRow(
    <div style={{ background: block.color ?? '#ede9ff', borderRadius: 10, padding: '12px 16px' }}>
      {editable({ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.6 }, 'Callout text…')}
    </div>
  )

  if (block.type === 'code') return wrapRow(
    <div style={{ background: '#1a1814', borderRadius: 10, padding: '14px 16px', overflow: 'auto' }}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="// Code here…"
        style={{ ...textStyle, fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 13, color: '#e8e4de', lineHeight: 1.65, tabSize: 2 }}
        onFocus={onFocus}
        onInput={e => onInput((e.target as HTMLDivElement).innerText)}
        onKeyDown={onKeyDown}
      >
        {block.content}
      </div>
    </div>
  )

  // paragraph (default)
  return wrapRow(editable({ fontSize: 14.5, color: 'var(--color-text)', lineHeight: 1.75 }))
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const navigate = useNavigate()
  const searchParams = useSearchParams()
  const pageId = Number(searchParams.get('id'))
  const [title, setTitle] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [topics, setTopics] = useState<Array<{ id: string; label: string; color: string; icon: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [slashState, setSlashState] = useState<{ id: string; query: string } | null>(null)
  const [menuIdx, setMenuIdx] = useState(0)
  const [aiPopoverId, setAiPopoverId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [linkedTopicId, setLinkedTopicId] = useState('none')
  const [topicDropOpen, setTopicDropOpen] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef('')
  const blocksRef = useRef<Block[]>([])
  const updatedAtRef = useRef<string | null>(null)

  const linkedTopic = topics.find(t => t.id === linkedTopicId) ?? { id: 'none', label: 'No topic link', color: 'var(--color-text-subtle)', icon: '○' }

  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  useEffect(() => {
    if (!Number.isInteger(pageId) || pageId <= 0) { navigate('/app/workspace'); return }
    let active = true
    Promise.all([
      api<{ page: ApiPage }>(`/workspace-pages/${pageId}`, { cache: 'no-store' }),
      api<{ topics: ApiTopic[] }>('/topics'),
    ]).then(([pageResult, topicResult]) => {
      if (!active) return
      const colors = ['#6d5ef6', '#e8845a', '#5ab58e', '#e8c45a', '#5ab5d4']
      const topicOptions = topicResult.topics.map((topic, index) => ({ id: String(topic.id), label: topic.title, color: colors[index % colors.length], icon: '📚' }))
      setTopics([...topicOptions, { id: 'none', label: 'No topic link', color: 'var(--color-text-subtle)', icon: '○' }])
      setTitle(pageResult.page.title)
      const loadedBlocks = pageResult.page.blocks.map(fromApiBlock)
      setBlocks(loadedBlocks.length ? loadedBlocks : [{ id: uid(), type: 'p', content: '' }])
      setLinkedTopicId(pageResult.page.topic_id ? String(pageResult.page.topic_id) : 'none')
      updatedAtRef.current = pageResult.page.updated_at
    }).catch(requestError => setError(messageFromError(requestError))).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [pageId])

  useEffect(() => {
    if (!topicDropOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-topic-drop]')) setTopicDropOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [topicDropOpen])

  const triggerSave = useCallback(() => {
    setSaveState('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        const result = await api<{ page: ApiPage }>(`/workspace-pages/${pageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: titleRef.current.trim() || 'Untitled', blocks: blocksRef.current.map(toApiBlock), expectedUpdatedAt: updatedAtRef.current }),
        })
        updatedAtRef.current = result.page.updated_at
        setSaveState('saved')
      } catch (requestError) {
        setError(messageFromError(requestError))
        setSaveState('unsaved')
      }
    }, 1200)
  }, [pageId])

  const filteredMenu = slashState
    ? BLOCK_MENU.filter(m => m.label.toLowerCase().includes(slashState.query.toLowerCase()) || m.type.includes(slashState.query))
    : []

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
    triggerSave()
  }

  const insertAfter = (id: string, type: BlockType = 'p') => {
    const idx = blocks.findIndex(b => b.id === id)
    const newBlock: Block = { id: uid(), type, content: '' }
    setBlocks(prev => [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)])
    setFocusedId(newBlock.id)
    setSlashState(null)
  }

  const deleteBlock = (id: string) => {
    if (blocks.length <= 1) return
    const idx = blocks.findIndex(b => b.id === id)
    setBlocks(prev => prev.filter(b => b.id !== id))
    const prev = blocks[Math.max(0, idx - 1)]
    if (prev) setFocusedId(prev.id)
    triggerSave()
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= blocks.length) return
    const next = [...blocks]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    setBlocks(next)
    triggerSave()
  }

  const handleKeyDown = (blockId: string, e: React.KeyboardEvent) => {
    const block = blocks.find(b => b.id === blockId)!

    // Escape closes menus
    if (e.key === 'Escape') {
      setSlashState(null)
      setAiPopoverId(null)
      return
    }

    // Navigate slash menu
    if (slashState?.id === blockId && filteredMenu.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIdx(i => Math.min(i + 1, filteredMenu.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenuIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const chosen = filteredMenu[menuIdx]
        if (chosen) {
          updateBlock(blockId, { type: chosen.type, content: '' })
          setSlashState(null)
          setMenuIdx(0)
        }
        return
      }
    }

    // Enter → new block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      insertAfter(blockId, block.type === 'ul' || block.type === 'ol' || block.type === 'todo' ? block.type : 'p')
      return
    }

    // Backspace on empty → delete
    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault()
      deleteBlock(blockId)
      return
    }
  }

  const handleInput = (blockId: string, text: string) => {
    // Detect slash command at start
    if (text.startsWith('/')) {
      const query = text.slice(1)
      setSlashState({ id: blockId, query })
      setMenuIdx(0)
    } else {
      setSlashState(null)
    }
    updateBlock(blockId, { content: text })
  }

  const changeType = (blockId: string, type: BlockType) => {
    updateBlock(blockId, { type, content: '' })
    setSlashState(null)
    setMenuIdx(0)
  }

  const saveStateLabel = saveState === 'saved' ? '✓ Saved' : saveState === 'saving' ? 'Saving…' : '● Unsaved'
  const saveStateColor = saveState === 'saved' ? '#5ab58e' : saveState === 'saving' ? '#8b8580' : '#e8845a'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--color-surface-2)' }}>
      {/* Top bar */}
      <div className="wp-topbar" style={{ height: 56, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, gap: 12 }}>

        {/* Left: back button — hidden on mobile (AppShell header handles it) */}
        <button
          className="wp-back"
          onClick={() => navigate('/app/workspace')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 7, transition: 'background 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          ← <span style={{ color: 'var(--color-text-subtle)' }}>Workspace</span>
        </button>

        {/* Center: URL / breadcrumb bar */}
        <div data-topic-drop className="wp-urlbar" style={{ flex: 1, maxWidth: 580, position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--color-surface)', borderRadius: 12,
            borderWidth: '1.5px', borderStyle: 'solid',
            borderColor: topicDropOpen ? linkedTopic.color + '66' : '#e8e4de',
            height: 38, padding: '0 6px 0 4px',
            boxShadow: topicDropOpen ? `0 0 0 3px ${linkedTopic.color}14` : '0 1px 3px rgba(24,22,15,0.05)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { if (!topicDropOpen) (e.currentTarget as HTMLDivElement).style.borderColor = '#c8c3bd' }}
            onMouseLeave={e => { if (!topicDropOpen) (e.currentTarget as HTMLDivElement).style.borderColor = '#e8e4de' }}
          >
            {/* Topic chip — clickable dropdown trigger */}
            <button
              onClick={() => setTopicDropOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 8px 4px 6px',
                background: topicDropOpen ? `${linkedTopic.color}18` : `${linkedTopic.color}10`,
                border: 'none', borderRadius: 7,
                cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${linkedTopic.color}22` }}
              onMouseLeave={e => { e.currentTarget.style.background = topicDropOpen ? `${linkedTopic.color}18` : `${linkedTopic.color}10` }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{linkedTopic.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: linkedTopic.color, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                {linkedTopic.id === 'none' ? 'No topic' : linkedTopic.label}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke={linkedTopic.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Separator */}
            <span style={{ fontSize: 15, color: '#d4cfc9', flexShrink: 0, userSelect: 'none', lineHeight: 1 }}>/</span>

            {/* Page title */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', padding: '0 2px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a8a3a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                {title || 'Untitled'}
              </span>
            </div>

            {/* Save state indicator */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: saveState === 'saved' ? '#5ab58e' : saveState === 'saving' ? '#e8c45a' : '#e8845a',
                transition: 'background 0.3s',
                boxShadow: saveState === 'saved' ? '0 0 0 2px #5ab58e22' : saveState === 'unsaved' ? '0 0 0 2px #e8845a22' : 'none',
              }} title={saveStateLabel} />
            </div>
          </div>

          {/* Topic dropdown panel */}
          {topicDropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
              background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)',
              boxShadow: '0 8px 28px rgba(24,22,15,0.13)', width: 240,
              padding: '6px',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>
                Move to topic
              </div>
              {topics.map(t => (
                <button
                  key={t.id}
                  onClick={async () => {
                    setLinkedTopicId(t.id)
                    setTopicDropOpen(false)
                    try {
                      const result = await api<{ page: ApiPage }>(`/workspace-pages/${pageId}/topic`, {
                        method: 'PATCH', body: JSON.stringify({ topic_id: t.id === 'none' ? null : Number(t.id) }),
                      })
                      updatedAtRef.current = result.page.updated_at
                    } catch (requestError) { setError(messageFromError(requestError)) }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '8px 10px', background: linkedTopicId === t.id ? '#ede9ff' : 'none',
                    border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (linkedTopicId !== t.id) e.currentTarget.style.background = 'var(--color-bg)' }}
                  onMouseLeave={e => { if (linkedTopicId !== t.id) e.currentTarget.style.background = 'none' }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: 7, background: `${t.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                  }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{t.label}</div>
                    {t.id !== 'none' && <div style={{ fontSize: 11, color: 'var(--color-text-subtle)' }}>Link page to this topic</div>}
                  </div>
                  {linkedTopicId === t.id && (
                    <span style={{ marginLeft: 'auto', color: '#6d5ef6', fontSize: 13, flexShrink: 0 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="wp-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="wp-save-label" style={{ fontSize: 11.5, color: saveState === 'saved' ? '#5ab58e' : saveState === 'saving' ? 'var(--color-text-muted)' : '#e8845a', fontWeight: 500 }}>{saveStateLabel}</span>
          <button className="wp-export" style={{ fontSize: 12.5, color: 'var(--color-text-2)', background: 'none', borderWidth: 1, borderStyle: 'solid', borderColor: '#e8e4de', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', transition: 'border-color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8c3bd' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e4de' }}
          >Export</button>
          <button style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(109,94,246,0.3)', transition: 'box-shadow 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(109,94,246,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(109,94,246,0.3)' }}
          >Share</button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 24px 80px' }} className="block-editor wp-editor">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {error && <div role="alert" style={{ marginBottom: 20, padding: '11px 14px', borderRadius: 10, background: 'var(--color-alert-red-bg)', color: '#d05a3e', fontSize: 13 }}>{error}</div>}
          {loading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading page…</div> : <>
          {/* Title */}
          <div
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Untitled"
            className="wp-title"
            style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.025em', lineHeight: 1.15, outline: 'none', marginBottom: 32, wordBreak: 'break-word', minHeight: '1em' }}
            onInput={e => { setTitle((e.target as HTMLDivElement).innerText); triggerSave() }}
          >{title}</div>

          {/* Blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {blocks.map(block => (
              <BlockRenderer
                key={block.id}
                block={block}
                focused={focusedId === block.id}
                showSlash={slashState?.id === block.id && (slashState.query !== undefined)}
                slashQuery={slashState?.id === block.id ? slashState.query : ''}
                filteredMenu={slashState?.id === block.id ? filteredMenu : []}
                menuIdx={menuIdx}
                aiPopover={aiPopoverId === block.id}
                onFocus={() => { setFocusedId(block.id); setAiPopoverId(null) }}
                onInput={text => handleInput(block.id, text)}
                onKeyDown={e => handleKeyDown(block.id, e)}
                onToggleCheck={() => updateBlock(block.id, { checked: !block.checked })}
                onToggleCollapse={() => updateBlock(block.id, { collapsed: !block.collapsed })}
                onMoveUp={() => moveBlock(block.id, -1)}
                onMoveDown={() => moveBlock(block.id, 1)}
                onDelete={() => deleteBlock(block.id)}
                onChangeType={type => changeType(block.id, type)}
                onAIAction={action => {
                  setAiPopoverId(null)
                  alert(`AI: ${action} on block "${block.content.slice(0, 40)}…"`)
                }}
                onCloseAI={() => setAiPopoverId(null)}
              />
            ))}
          </div>

          {/* Add block */}
          <button
            onClick={() => {
              const newBlock: Block = { id: uid(), type: 'p', content: '' }
              setBlocks(prev => [...prev, newBlock])
              setFocusedId(newBlock.id)
            }}
            style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--color-text-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', transition: 'color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#6d5ef6' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#a8a3a0' }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add a block <span style={{ fontSize: 12, opacity: 0.7 }}>or type / for commands</span>
          </button>
          </>}
        </div>
      </div>

      {/* AI floating button */}
      {focusedId && (
        <button
          className="ask-ai-fab"
          onClick={() => setAiPopoverId(prev => prev === focusedId ? null : focusedId)}
          style={{
            position: 'fixed', bottom: 28, right: 32,
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 13.5, fontWeight: 600, color: '#fff', background: '#6d5ef6',
            border: 'none', borderRadius: 999, padding: '11px 18px', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(109,94,246,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s, bottom 0.15s',
            zIndex: 40,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(109,94,246,0.45)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(109,94,246,0.4)' }}
        >
          ✦ Ask AI
        </button>
      )}

      <style>{`
        @media (max-width: 900px) {
          /* Push Ask AI above the bottom tab bar */
          .ask-ai-fab {
            bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 16px) !important;
            right: 16px !important;
            padding: 10px 16px !important;
            font-size: 13px !important;
          }
          /* Hide back button — AppShell mobile header handles nav */
          .wp-back { display: none !important; }
          /* Collapse save label text */
          .wp-save-label { display: none !important; }
          /* Hide Export/Share buttons — keep only icons */
          .wp-export { display: none !important; }
          /* Shrink action row */
          .wp-actions { gap: 6px !important; }
          /* URL bar: remove maxWidth cap so it fills available space */
          .wp-urlbar { max-width: 100% !important; }
          /* Reduce top bar height */
          .wp-topbar { height: 46px !important; padding: 0 10px !important; gap: 8px !important; }
          /* Smaller title font on mobile */
          .wp-title { font-size: 26px !important; margin-bottom: 20px !important; }
          /* Reduce editor padding */
          .wp-editor { padding: 24px 14px 80px !important; }
        }
      `}</style>
    </div>
  )
}
