'use client'
import { useState, useEffect, type CSSProperties } from 'react'
import { useNavigate, Link } from '../lib/navigation'

function IconSparkles() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function ProductMockup() {
  const topics = [
    { name: 'Organic Chemistry', mastery: 74, color: '#6d5ef6', status: 'On track' },
    { name: 'Biochemistry', mastery: 51, color: '#e8845a', status: 'At risk' },
    { name: 'Pharmacology', mastery: 88, color: '#5ab58e', status: 'Strong' },
  ]
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 20, boxShadow: '0 24px 64px rgba(24,22,15,0.12), 0 4px 16px rgba(24,22,15,0.06)', overflow: 'hidden', width: '100%', maxWidth: 500, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <div style={{ background: 'var(--color-bg)', padding: '10px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff6058','#ffbd2e','#28c840'].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: 'var(--color-surface-2)', borderRadius: 5, padding: '3px 10px', fontSize: 10.5, color: 'var(--color-text-muted)', textAlign: 'center' }}>app.studia.ai/dashboard</div>
      </div>
      <div style={{ display: 'flex', minHeight: 340 }}>
        <div style={{ width: 48, background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: '#6d5ef6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>s</span>
          </div>
          {['📊','📚','💬','🃏','🎯'].map((icon, i) => (
            <div key={i} style={{ width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 0 ? '#ede9ff' : 'transparent', fontSize: 13 }}>{icon}</div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>Good morning, Layla</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Your study overview</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            {[{l:'Streak',v:'14',e:'🔥'},{l:'Topics',v:'3',e:'📚'},{l:'Due',v:'28',e:'🃏'}].map((s,i) => (
              <div key={i} style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 14 }}>{s.e}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{s.v}</div>
                <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Topics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {topics.map((t, i) => (
              <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text)', marginBottom: 3 }}>{t.name}</div>
                  <div style={{ height: 3.5, background: 'var(--color-surface-2)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${t.mastery}%`, background: t.color, borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.color }}>{t.mastery}%</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, background: '#ede9ff', borderRadius: 9, padding: '9px 11px', display: 'flex', gap: 7 }}>
            <span style={{ fontSize: 13 }}>📋</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6d5ef6' }}>Coach says</div>
              <div style={{ fontSize: 10.5, color: '#3d3280', lineHeight: 1.4 }}>Review Biochemistry — 18 cards due. Exam in <strong>12 days</strong>.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const btnPrimary: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontSize: 14.5, fontWeight: 600, color: '#fff', textDecoration: 'none',
    background: '#6d5ef6', borderRadius: 11, padding: '12px 22px',
    border: 'none', cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(109,94,246,0.35)', transition: 'background 0.15s, transform 0.1s',
  }
  const btnOutline: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontSize: 14.5, fontWeight: 500, color: 'var(--color-text)', textDecoration: 'none',
    background: 'transparent', borderRadius: 11, padding: '12px 22px',
    border: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.15s',
  }

  const features = [
    { icon: '🧠', tag: 'AI Tutor', color: '#6d5ef6', bg: '#ede9ff', title: 'A tutor that read your notes', desc: 'Ask anything. Every answer is grounded in your uploaded material — not the generic internet. Source citations included.' },
    { icon: '✨', tag: 'Auto-generation', color: '#5a8f7c', bg: '#e4f4ee', title: 'Flashcards, quizzes, graphs — instantly', desc: 'Upload a PDF and get a complete study system in seconds: spaced-rep flashcards, adaptive quizzes, and a visual knowledge graph.' },
    { icon: '🎯', tag: 'Study Coach', color: '#e8845a', bg: '#faeee7', title: 'A plan that closes the loop', desc: 'Every wrong answer feeds back into your plan. Weak concepts resurface in the coach, turn red on your graph, and reappear in your deck.' },
  ]

  const steps = [
    { n: '01', t: 'Upload your material', d: 'Add lecture notes, textbook PDFs, or type directly. Organise by topic. That\'s it.' },
    { n: '02', t: 'Studia builds your system', d: 'Flashcards, quizzes, a knowledge graph, and a mind map — generated from your material in seconds.' },
    { n: '03', t: 'The coach adapts daily', d: 'Your plan updates as you study. Struggling? It rises in priority. Exam approaching? Everything tightens.' },
  ]

  const quotes = [
    { q: '"I went from failing Biochem midterms to 84% on finals. The coach plan made it obvious what I was missing."', name: 'Layla A.', role: 'Medical student', av: '#a78b5f', i: 'L' },
    { q: '"The first tool that felt like a study partner who actually read my notes — not just a chatbot."', name: 'Marcus C.', role: 'Bar exam candidate', av: '#7c8fa5', i: 'M' },
    { q: '"I stopped copying Reddit answers and started actually understanding. The tutor cites my own notes."', name: 'Riya P.', role: 'CS undergrad', av: '#9b7ea5', i: 'R' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: "'Outfit', system-ui, sans-serif", color: 'var(--color-text)' }}>
      {/* Navbar */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? 'var(--marketing-header-bg)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', borderBottom: `1px solid ${scrolled ? 'rgba(232,228,222,0.8)' : 'transparent'}`, transition: 'all 0.2s' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#6d5ef6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>s</span>
            </div>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700 }}>Studia</span>
          </div>
          <nav style={{ display: 'flex', gap: 28 }} className="landing-nav">
            {['Features','How it works','Pricing'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(' ','-')}`} style={{ fontSize: 13.5, color: 'var(--color-text-2)', textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
          </nav>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => navigate('/app')} style={{ ...btnOutline, padding: '8px 14px', fontSize: 13 }} className="landing-login">Log in</button>
            <button onClick={() => navigate('/app')} style={{ ...btnPrimary, padding: '8px 16px', fontSize: 13 }}>Start free</button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="landing-hamburger" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4, display: 'none' }}>☰</button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(24,22,15,0.3)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 260, background: 'var(--color-bg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', alignSelf: 'flex-end', marginBottom: 12 }}>✕</button>
            {['Features','How it works','Pricing','Log in'].map(l => (
              <a key={l} href="#" onClick={() => setMenuOpen(false)} style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>{l}</a>
            ))}
            <button onClick={() => navigate('/app')} style={{ ...btnPrimary, marginTop: 16, justifyContent: 'center' }}>Start for free</button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section style={{ paddingTop: 116, paddingBottom: 80, maxWidth: 1100, margin: '0 auto', padding: '116px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="landing-hero-grid">
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9ff', borderRadius: 999, padding: '5px 13px', marginBottom: 26, fontSize: 12, fontWeight: 600, color: '#6d5ef6' }}>
              <IconSparkles /> AI-powered study companion
            </div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(34px, 4.5vw, 58px)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 22 }}>
              Learn smarter.{' '}<span style={{ color: '#6d5ef6' }}>Remember</span>{' '}more.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--color-text-2)', marginBottom: 36, maxWidth: 420 }}>
              Upload your notes once. Studia turns them into flashcards, quizzes, a tutor grounded in your material, and a plan that knows exactly what to study next.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 36 }}>
              <button onClick={() => navigate('/app')} style={btnPrimary}>Start studying free <IconArrow /></button>
              <a href="#how-it-works" style={btnOutline}>See how it works</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex' }}>
                {['#a78b5f','#7c8fa5','#9b7ea5','#5a8f7c'].map((bg, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: bg, border: '2px solid var(--color-bg)', marginLeft: i > 0 ? -7 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600 }}>
                    {['L','M','R','S'][i]}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-2)' }}><strong style={{ color: 'var(--color-text)' }}>4,200+ students</strong> already using Studia</p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ transform: 'perspective(1000px) rotateY(-4deg) rotateX(2deg)', transition: 'transform 0.3s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'perspective(1000px) rotateY(0) rotateX(0)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'perspective(1000px) rotateY(-4deg) rotateX(2deg)' }}
            >
              <ProductMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Logo strip */}
      <div style={{ background: 'var(--color-surface-2)', borderTop: '1px solid #e0dbd4', borderBottom: '1px solid #e0dbd4', padding: '18px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Used by students at</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
            {['University of Toronto','Imperial College London','McGill University','ETH Zürich','UCL','KAIST'].map(o => (
              <span key={o} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>{o}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="features" style={{ padding: '88px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>One system, not five tools</div>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 14 }}>Every tool knows what you know</h2>
          <p style={{ fontSize: 15.5, color: 'var(--color-text-2)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>Studia's tools talk to each other. A weak quiz answer becomes a coach task, a red graph node, and a flashcard.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }} className="landing-3col">
          {features.map((f, i) => (
            <div key={i} style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 26, border: '1px solid var(--color-border)', transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 36px rgba(24,22,15,0.08)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'inline-flex', width: 40, height: 40, borderRadius: 10, background: f.bg, alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: f.color, background: f.bg, borderRadius: 999, padding: '3px 9px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, display: 'inline-block' }}>{f.tag}</div>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, lineHeight: 1.25, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text-2)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ background: '#18160f', padding: '88px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</div>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700, color: '#f7f5f1', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Upload once. Study smarter<br />from that moment on.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 40 }} className="landing-3col">
            {steps.map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, fontWeight: 700, color: '#6d5ef6', opacity: 0.6, marginBottom: 14, lineHeight: 1 }}>{s.n}</div>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, color: '#f7f5f1', marginBottom: 10, lineHeight: 1.25 }}>{s.t}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'rgba(247,245,241,0.5)' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '88px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 16 }}>
            {[...Array(5)].map((_, i) => <span key={i} style={{ color: '#6d5ef6', fontSize: 14 }}>★</span>)}
          </div>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Students who juggled five apps<br />now use one.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }} className="landing-3col">
          {quotes.map((q, i) => (
            <div key={i} style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 26, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
              <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--color-text-2)', fontStyle: 'italic', fontFamily: "'Fraunces', Georgia, serif" }}>{q.q}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: q.av, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{q.i}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>{q.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: 'var(--color-surface-2)', padding: '88px 24px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Simple pricing</div>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Start free. Upgrade when ready.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="landing-2col">
            <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 30, border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Beta</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Free</div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 24 }}>Everything you need to start.</p>
              <button onClick={() => navigate('/app')} style={{ width: '100%', ...btnOutline, justifyContent: 'center', marginBottom: 24 }}>Get started</button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['3 topics','50 AI messages/month','Flashcards & quizzes','Knowledge graph','Study history'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--color-text-2)' }}>
                    <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#e8e4de', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-2)', flexShrink: 0 }}><IconCheck /></div>
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#18160f', borderRadius: 16, padding: 30, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -24, right: -24, width: 100, height: 100, borderRadius: '50%', background: 'rgba(109,94,246,0.15)' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6d5ef6', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 700, color: '#f7f5f1' }}>$12</span>
                <span style={{ fontSize: 13, color: 'rgba(247,245,241,0.4)', marginBottom: 7 }}>/month</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'rgba(247,245,241,0.4)', marginBottom: 24 }}>For serious exam prep. Cancel anytime.</p>
              <button onClick={() => navigate('/app')} style={{ width: '100%', ...btnPrimary, justifyContent: 'center', marginBottom: 24 }}>Start free for 14 days</button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['Unlimited topics','Unlimited AI messages','Exams with Bloom\'s scoring','Study coach + readiness forecast','Mistake notebook + analytics','CSV import/export'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'rgba(247,245,241,0.7)' }}>
                    <div style={{ width: 17, height: 17, borderRadius: '50%', background: 'rgba(109,94,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9b8fff', flexShrink: 0 }}><IconCheck /></div>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '88px 24px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(28px, 4.5vw, 50px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 18 }}>
          Study with clarity.<br /><span style={{ color: '#6d5ef6' }}>Grow with confidence.</span>
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--color-text-2)', marginBottom: 36 }}>Turn "I don't know what I don't know" into a concrete, prioritised study plan — in under a minute.</p>
        <button onClick={() => navigate('/app')} style={{ ...btnPrimary, fontSize: 15, padding: '13px 26px' }}>
          Start for free — no credit card <IconArrow />
        </button>
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--color-text-subtle)' }}>Free beta · No credit card · Cancel anytime</p>
      </section>

      {/* Footer */}
      <footer style={{ background: '#18160f', padding: '56px 24px 36px', borderTop: '1px solid rgba(247,245,241,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }} className="landing-footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: '#6d5ef6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>s</span>
                </div>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, color: '#f7f5f1' }}>Studia</span>
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.7, color: 'rgba(247,245,241,0.35)', maxWidth: 200 }}>AI-powered study companion. Learn smarter. Remember more.</p>
            </div>
            {([['Product',['Features','Pricing','Changelog']],['Resources',['Docs','Blog','Community']],['Legal',['Privacy','Terms','Cookies']]] as [string, string[]][]).map(([g, items]) => {
              const slugs: Record<string, string> = { Features: '/features', Pricing: '/pricing', Changelog: '/changelog', Docs: '/docs', Blog: '/blog', Community: '/community', Privacy: '/privacy', Terms: '/terms', Cookies: '/cookies' }
              return (
                <div key={g}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(247,245,241,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>{g}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {items.map(item => (
                      <Link key={item} to={slugs[item]} style={{ fontSize: 13, color: 'rgba(247,245,241,0.45)', textDecoration: 'none' }}>{item}</Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ borderTop: '1px solid rgba(247,245,241,0.08)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 11.5, color: 'rgba(247,245,241,0.2)' }}>© 2026 Studia. All rights reserved.</p>
            <p style={{ fontSize: 11.5, color: 'rgba(247,245,241,0.2)' }}>Made for curious minds everywhere.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 900px) {
          .landing-nav, .landing-login { display: none !important; }
          .landing-hamburger { display: block !important; }
          .landing-hero-grid, .landing-3col { grid-template-columns: 1fr !important; }
          .landing-hero-grid > div:last-child { order: -1; }
          .landing-2col { grid-template-columns: 1fr !important; }
          .landing-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
        }
        @media (max-width: 540px) { .landing-footer-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
