'use client'
import { useState } from 'react'
import { useNavigate, Link } from '../lib/navigation'
import type { ReactNode } from 'react'

const FOOTER_LINKS = [
  ['Product',   ['Features', 'Pricing', 'Changelog']],
  ['Resources', ['Docs', 'Blog', 'Community']],
  ['Legal',     ['Privacy', 'Terms', 'Cookies']],
] as const

const SLUG: Record<string, string> = {
  Features: '/features', Pricing: '/pricing', Changelog: '/changelog',
  Docs: '/docs', Blog: '/blog', Community: '/community',
  Privacy: '/privacy', Terms: '/terms', Cookies: '/cookies',
}

export default function MarketingShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: "'Outfit', system-ui, sans-serif", color: 'var(--color-text)' }}>
      {/* Nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--marketing-header-bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(232,228,222,0.8)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#6d5ef6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>S</span>
            </div>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>Studia</span>
          </Link>
          <nav style={{ display: 'flex', gap: 28 }} className="mkt-nav">
            {['Features', 'Pricing', 'Blog'].map(l => (
              <Link key={l} to={SLUG[l]} style={{ fontSize: 13.5, color: 'var(--color-text-2)', textDecoration: 'none', fontWeight: 500 }}>{l}</Link>
            ))}
          </nav>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/app')} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer' }}>Log in</button>
            <button onClick={() => navigate('/app')} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(109,94,246,0.3)' }}>Start free</button>
            <button onClick={() => setMenuOpen(true)} className="mkt-hamburger" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4 }}>☰</button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(24,22,15,0.3)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 260, background: 'var(--color-bg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', alignSelf: 'flex-end', marginBottom: 12 }}>✕</button>
            {['Features', 'Pricing', 'Blog', 'Docs'].map(l => (
              <Link key={l} to={SLUG[l]} onClick={() => setMenuOpen(false)} style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>{l}</Link>
            ))}
            <button onClick={() => navigate('/app')} style={{ marginTop: 16, fontSize: 14, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer' }}>Start free</button>
          </div>
        </div>
      )}

      {/* Page content */}
      {children}

      {/* Footer */}
      <footer style={{ background: '#18160f', padding: '56px 24px 36px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }} className="mkt-footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: '#6d5ef6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>S</span>
                </div>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, color: '#f7f5f1' }}>Studia</span>
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.7, color: 'rgba(247,245,241,0.35)', maxWidth: 200 }}>AI-powered study companion. Learn smarter. Remember more.</p>
            </div>
            {FOOTER_LINKS.map(([group, items]) => (
              <div key={group}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(247,245,241,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>{group}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {items.map(item => (
                    <Link key={item} to={SLUG[item]} style={{ fontSize: 13, color: 'rgba(247,245,241,0.5)', textDecoration: 'none', transition: 'color 0.12s' }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(247,245,241,0.85)' }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(247,245,241,0.5)' }}
                    >{item}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(247,245,241,0.08)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 11.5, color: 'rgba(247,245,241,0.2)' }}>© 2026 Studia. All rights reserved.</p>
            <p style={{ fontSize: 11.5, color: 'rgba(247,245,241,0.2)' }}>Made for curious minds everywhere.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 700px) {
          .mkt-nav { display: none !important; }
          .mkt-hamburger { display: block !important; }
          .mkt-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
        }
        @media (max-width: 480px) {
          .mkt-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
