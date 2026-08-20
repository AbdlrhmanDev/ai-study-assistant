'use client'
import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from '../lib/navigation'
import type { ReactNode } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import ProfileAvatar from './ProfileAvatar'

/* ─── SVG icon set ─────────────────────────────────────────────── */
const Icon = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  topics: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="8" y1="7" x2="15" y2="7"/><line x1="8" y1="11" x2="13" y2="11"/></svg>,
  workspace: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  coach: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  cards: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="14" height="10" rx="2"/><rect x="8" y="9" width="14" height="10" rx="2"/></svg>,
  quiz: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>,
  tutor: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="13.5" x2="13" y2="13.5"/></svg>,
  history: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  mistakes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  analytics: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/></svg>,
  review: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  billing: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  settings: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  collapse: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  expand: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
}

type NavItem = { label: string; path: string; icon: React.ReactNode; group: string }

const NAV: NavItem[] = [
  { label: 'Overview',         path: '/app/dashboard',   icon: Icon.home,      group: 'orient' },
  { label: 'My topics',        path: '/app/topics',       icon: Icon.topics,    group: 'organize' },
  { label: 'Workspace',        path: '/app/workspace',    icon: Icon.workspace, group: 'organize' },
  { label: 'Study coach',      path: '/app/coach',        icon: Icon.coach,     group: 'study' },
  { label: 'Flashcards',       path: '/app/flashcards',   icon: Icon.cards,     group: 'study' },
  { label: 'Quizzes',          path: '/app/quizzes',      icon: Icon.quiz,      group: 'study' },
  { label: 'AI tutor',         path: '/app/ai-tutor',     icon: Icon.tutor,     group: 'study' },
  { label: 'Study history',    path: '/app/history',      icon: Icon.history,   group: 'reflect' },
  { label: 'Mistake notebook', path: '/app/mistakes',     icon: Icon.mistakes,  group: 'reflect' },
  { label: 'Analytics',        path: '/app/analytics',    icon: Icon.analytics, group: 'reflect' },
  { label: 'SaaS Review',      path: '/app/saas-review',  icon: Icon.review,    group: 'reflect' },
  { label: 'Billing',          path: '/app/billing',      icon: Icon.billing,   group: 'account' },
]



const GROUP_LABELS: Record<string, string> = {
  orient: 'Orient', organize: 'Organize', study: 'Study', reflect: 'Reflect', account: 'Account',
}

const BOTTOM_TABS = [
  { label: 'Home', path: '/app/dashboard', icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#6d5ef6' : 'var(--shell-nav-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { label: 'Topics', path: '/app/topics', icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#6d5ef6' : 'var(--shell-nav-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M8 7h8M8 11h6"/></svg> },
  { label: 'Review', path: '/app/flashcards', icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#6d5ef6' : 'var(--shell-nav-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="14" height="10" rx="2"/><rect x="8" y="9" width="14" height="10" rx="2"/></svg> },
  { label: 'Tutor', path: '/app/ai-tutor', icon: (a: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? '#6d5ef6' : 'var(--shell-nav-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
]

const MORE_ITEMS = [
  { label: 'Workspace',     path: '/app/workspace',  icon: Icon.workspace },
  { label: 'Study coach',  path: '/app/coach',       icon: Icon.coach },
  { label: 'Flashcards',   path: '/app/flashcards',  icon: Icon.cards },
  { label: 'Quizzes',      path: '/app/quizzes',     icon: Icon.quiz },
  { label: 'Study history',path: '/app/history',     icon: Icon.history },
  { label: 'Mistakes',     path: '/app/mistakes',    icon: Icon.mistakes },
  { label: 'Analytics',    path: '/app/analytics',   icon: Icon.analytics },
  { label: 'Settings',     path: '/app/settings',    icon: Icon.settings },
]

const SIDEBAR_W = 228
const SIDEBAR_MINI = 64

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('studia-sidebar-collapsed') === '1' } catch { return false }
  })
  const [moreOpen, setMoreOpen] = useState(false)
  const { isDark, toggle } = useTheme()
  const { user } = useAuth()
  const [planLabel, setPlanLabel] = useState('Plan')

  useEffect(() => {
    void api<{ label: string }>('/plans/me').then(plan => setPlanLabel(plan.label)).catch(() => undefined)
  }, [])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    try { localStorage.setItem('studia-sidebar-collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  const groups = ['orient', 'organize', 'study', 'reflect', 'account']
  const moreActive = MORE_ITEMS.some(item => location.pathname.startsWith(item.path))
  const sidebarW = collapsed ? SIDEBAR_MINI : SIDEBAR_W

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)', fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(24,22,15,0.4)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <aside
        className="sidebar"
        data-open={sidebarOpen ? 'true' : 'false'}
        data-collapsed={collapsed ? 'true' : 'false'}
        style={{
          width: sidebarW,
          flexShrink: 0,
          background: 'var(--shell-sidebar-bg)',
          borderRight: '1px solid var(--shell-sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          overflowY: 'auto', overflowX: 'hidden',
          overscrollBehavior: 'contain',
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), background 0.25s, border-color 0.25s',
        }}
      >
        {/* Logo row */}
        <div style={{
          padding: collapsed ? '18px 0' : '16px 14px 14px',
          borderBottom: '1px solid var(--shell-sidebar-border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
          transition: 'padding 0.22s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #7c6ff7 0%, #5a4ee0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(109,94,246,0.35)' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>S</span>
            </div>
            {!collapsed && (
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700, color: 'var(--shell-logo-text)', whiteSpace: 'nowrap', opacity: collapsed ? 0 : 1, transition: 'opacity 0.15s' }}>Studia</span>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{ width: 26, height: 26, borderRadius: 7, background: 'none', border: '1px solid var(--shell-sidebar-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--shell-nav-muted)', flexShrink: 0, transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--shell-nav-hover-bg)'; e.currentTarget.style.color = 'var(--shell-nav-text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--shell-nav-muted)' }}
            >
              {Icon.collapse}
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            style={{ margin: '10px auto 2px', width: 36, height: 30, borderRadius: 8, background: 'none', border: '1px solid var(--shell-sidebar-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--shell-nav-muted)', transition: 'background 0.12s, color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--shell-nav-hover-bg)'; e.currentTarget.style.color = 'var(--shell-nav-text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--shell-nav-muted)' }}
          >
            {Icon.expand}
          </button>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: collapsed ? '8px 0' : '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {groups.map((group, gi) => (
            <div key={group} style={{ marginBottom: collapsed ? 6 : 4 }}>
              {!collapsed && (
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--shell-nav-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: gi === 0 ? '4px 10px 3px' : '10px 10px 3px' }}>
                  {GROUP_LABELS[group]}
                </div>
              )}
              {collapsed && gi > 0 && (
                <div style={{ height: 1, background: 'var(--shell-sidebar-border)', margin: '6px 12px 6px' }} />
              )}
              {NAV.filter(n => n.group === group).map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/app/workspace'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => isActive ? 'nav-item nav-active' : 'nav-item'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 9, padding: collapsed ? '9px 0' : '7px 10px', margin: collapsed ? '1px 10px' : '1px 0', borderRadius: 9, textDecoration: 'none', fontSize: 13.5, overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  {({ isActive }) => (
                    <>
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: isActive ? 'var(--shell-nav-active-text)' : 'var(--shell-nav-text)' }}>
                        {item.icon}
                      </span>
                      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--shell-nav-active-text)' : 'var(--shell-nav-text)' }}>{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: collapsed ? '10px 0 16px' : '8px 8px 14px', borderTop: '1px solid var(--shell-footer-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: collapsed ? 'center' : 'stretch' }}>
          {/* Dark mode toggle */}
          {collapsed ? (
            <button
              onClick={toggle}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 36, height: 34, borderRadius: 9, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--shell-nav-muted)', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--shell-nav-hover-bg)'; e.currentTarget.style.color = 'var(--shell-nav-text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--shell-nav-muted)' }}
            >
              {isDark ? Icon.sun : Icon.moon}
            </button>
          ) : (
            <button
              onClick={toggle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 9, background: 'none', border: 'none', cursor: 'pointer', width: '100%', transition: 'background 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--shell-nav-hover-bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--shell-nav-text)' }}>
                <span style={{ display: 'flex', color: 'var(--shell-nav-muted)' }}>{isDark ? Icon.sun : Icon.moon}</span>
                {isDark ? 'Light mode' : 'Dark mode'}
              </div>
              <div style={{ width: 34, height: 19, borderRadius: 10, background: isDark ? '#6d5ef6' : 'var(--shell-sidebar-border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', width: 13, height: 13, borderRadius: '50%', background: 'var(--color-surface)', top: 3, left: isDark ? 18 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => navigate('/app/settings')}
            title={collapsed ? 'Settings' : undefined}
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 9, padding: collapsed ? '9px 0' : '7px 10px', width: collapsed ? 36 : '100%', height: collapsed ? 34 : 'auto', borderRadius: 9, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--shell-nav-text)', transition: 'background 0.12s, color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--shell-nav-hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <span style={{ display: 'flex', color: 'var(--shell-nav-muted)', flexShrink: 0 }}>{Icon.settings}</span>
            {!collapsed && <span>Settings</span>}
          </button>

          {/* User */}
          {!collapsed ? (
            <button
              onClick={() => navigate('/app/settings')}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, background: 'none', border: 'none', cursor: 'pointer', width: '100%', marginTop: 2, transition: 'background 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--shell-nav-hover-bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <ProfileAvatar user={user} size={28}/>
              <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--shell-user-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || user?.email || 'Student'}</div>
                <div style={{ fontSize: 11, color: 'var(--shell-user-sub)' }}>{planLabel}</div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => navigate('/app/settings')}
              title={user?.name || user?.email || 'Student'}
              style={{ width: 36, height: 36, padding:0, borderRadius: '50%', background:'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginTop: 4 }}
            ><ProfileAvatar user={user} size={36}/></button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content" style={{ flex: 1, marginLeft: sidebarW, minWidth: 0, transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Mobile header */}
        <div className="mobile-header" style={{
          display: 'none', padding: '12px 20px',
          background: 'var(--shell-mobile-bg)',
          borderBottom: '1px solid var(--shell-mobile-border)',
          alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 30,
          transition: 'background 0.25s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--shell-nav-text)', display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #7c6ff7 0%, #5a4ee0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>S</span>
            </div>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, color: 'var(--shell-logo-text)' }}>Studia</span>
          </div>
          <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4, color: 'var(--shell-nav-text)', display: 'flex' }}>
            {isDark ? Icon.sun : Icon.moon}
          </button>
        </div>

        {/* Page content */}
        <div className="page-content" style={{ background: 'var(--color-bg)', minHeight: '100%' }}>
          {children}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="bottom-tab-bar" style={{ display: 'none' }}>
        {BOTTOM_TABS.map(tab => (
          <NavLink key={tab.path} to={tab.path} end onClick={() => setMoreOpen(false)}
            style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, flex: 1, padding: '8px 0 4px' }}
          >
            {({ isActive }) => (
              <>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 28, borderRadius: 10, background: isActive ? 'var(--shell-nav-active-bg)' : 'transparent', transition: 'background 0.15s' }}>
                  {tab.icon(isActive)}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--shell-nav-active-text)' : 'var(--shell-nav-muted)' }}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, flex: 1, padding: '8px 0 4px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 28, borderRadius: 10, background: moreOpen || moreActive ? 'var(--shell-nav-active-bg)' : 'transparent', transition: 'background 0.15s' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={moreOpen || moreActive ? '#6d5ef6' : 'var(--shell-nav-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="12" r="1.5" fill={moreOpen || moreActive ? '#6d5ef6' : 'var(--shell-nav-muted)'}/>
              <circle cx="12" cy="12" r="1.5" fill={moreOpen || moreActive ? '#6d5ef6' : 'var(--shell-nav-muted)'}/>
              <circle cx="19" cy="12" r="1.5" fill={moreOpen || moreActive ? '#6d5ef6' : 'var(--shell-nav-muted)'}/>
            </svg>
          </span>
          <span style={{ fontSize: 10.5, fontWeight: moreOpen || moreActive ? 600 : 400, color: moreOpen || moreActive ? 'var(--shell-nav-active-text)' : 'var(--shell-nav-muted)' }}>More</span>
        </button>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="more-sheet-backdrop" onClick={() => setMoreOpen(false)}
          style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(24,22,15,0.4)', zIndex: 55, alignItems: 'flex-end' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--shell-more-bg)', borderRadius: '20px 20px 0 0', padding: '0 0 calc(env(safe-area-inset-bottom, 0px) + 80px)', boxShadow: '0 -8px 32px rgba(24,22,15,0.15)', animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--shell-sidebar-border)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 20px 16px' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Study tools</div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: 'var(--shell-logo-text)' }}>More</div>
              </div>
              <button onClick={() => setMoreOpen(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--shell-more-item-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--shell-nav-text)', marginTop: 4 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px' }}>
              {MORE_ITEMS.map(item => {
                const isActive = location.pathname.startsWith(item.path)
                return (
                  <button key={item.path} onClick={() => { navigate(item.path); setMoreOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14, background: isActive ? 'var(--shell-nav-active-bg)' : 'var(--shell-more-item-bg)', border: isActive ? '1.5px solid rgba(109,94,246,0.3)' : '1.5px solid transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s', color: isActive ? 'var(--shell-nav-active-text)' : 'var(--shell-nav-text)' }}
                  >
                    <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .sidebar { transform: translateX(-100%); width: ${SIDEBAR_W}px !important; transition: transform 0.25s cubic-bezier(0.4,0,0.2,1) !important; }
          .sidebar[data-open="true"] { transform: translateX(0) !important; }
          .main-content { margin-left: 0 !important; }
          .mobile-header { display: flex !important; }
          .page-content { padding-bottom: 64px; }
          .bottom-tab-bar {
            display: flex !important;
            position: fixed; bottom: 0; left: 0; right: 0;
            height: calc(64px + env(safe-area-inset-bottom, 0px));
            background: var(--shell-tab-bg);
            border-top: 1px solid var(--shell-tab-border);
            z-index: 50;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -4px 20px rgba(24,22,15,0.06);
            transition: background 0.25s;
          }
          .more-sheet-backdrop { display: flex !important; }
        }

        /* Tooltip on collapsed sidebar items (native title attr on desktop) */
        .sidebar[data-collapsed="true"] a, .sidebar[data-collapsed="true"] button {
          position: relative;
        }
      `}</style>
    </div>
  )
}
