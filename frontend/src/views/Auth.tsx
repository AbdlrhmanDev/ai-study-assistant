'use client'

import { useState, type FormEvent } from 'react'
import { api, messageFromError, type User } from '../lib/api'
import { Link, useNavigate } from '../lib/navigation'
import { useAuth } from '../contexts/AuthContext'

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim().toLowerCase()
    const password = String(data.get('password') ?? '')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError('Enter a valid email address.')
    if (!isLogin && name.length < 2) return setError('Name must be at least 2 characters.')
    if (!isLogin && password.length < 8) return setError('Password must be at least 8 characters.')

    setLoading(true)
    try {
      await api<{ user: User }>(isLogin ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...(!isLogin ? { name } : {}), email, password }),
      })
      await refresh()
      navigate('/app/dashboard')
    } catch (requestError) {
      setError(messageFromError(requestError))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #ded9d1', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, outline: 'none' }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(420px, 1.1fr)', background: 'var(--color-bg)' }} className="auth-grid">
      <section style={{ padding: 48, background: 'linear-gradient(145deg, #1c1830, #18160f)', color: '#f7f5f1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700 }}>Studia</Link>
        <div style={{ maxWidth: 460 }}>
          <div style={{ color: '#9b8fff', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', marginBottom: 16 }}>LEARN WITH CLARITY</div>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 48, lineHeight: 1.08, marginBottom: 18 }}>Your study workspace, powered by your own material.</h1>
          <p style={{ color: 'rgba(247,245,241,.58)', lineHeight: 1.7 }}>Build topics, review flashcards, take quizzes, and ask your AI tutor—all from one account.</p>
        </div>
        <p style={{ color: 'rgba(247,245,241,.35)', fontSize: 12 }}>Studia AI Study Assistant</p>
      </section>
      <section style={{ padding: 32, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 430, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: 32, boxShadow: '0 18px 60px rgba(24,22,15,.08)' }}>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, marginBottom: 6 }}>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 26 }}>{isLogin ? 'Sign in to continue studying.' : 'Start building your personal study workspace.'}</p>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!isLogin && <label style={{ fontSize: 13, fontWeight: 600 }}>Full name<input name="name" autoComplete="name" required minLength={2} style={{ ...inputStyle, marginTop: 7 }} /></label>}
            <label style={{ fontSize: 13, fontWeight: 600 }}>Email address<input name="email" type="email" autoComplete="email" required style={{ ...inputStyle, marginTop: 7 }} /></label>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Password
              <div style={{ position: 'relative', marginTop: 7 }}>
                <input name="password" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={isLogin ? 1 : 8} style={{ ...inputStyle, paddingRight: 68 }} />
                <button type="button" onClick={() => setShowPassword(value => !value)} style={{ position: 'absolute', right: 8, top: 7, border: 0, background: 'none', color: '#6d5ef6', cursor: 'pointer', padding: 6 }}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </label>
            {error && <div role="alert" style={{ color: '#a83f27', background: 'var(--color-alert-red-bg)', borderRadius: 9, padding: '10px 12px', fontSize: 13 }}>{error}</div>}
            <button disabled={loading} type="submit" style={{ border: 0, borderRadius: 10, padding: 13, background: '#6d5ef6', color: '#fff', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}</button>
          </form>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, marginTop: 20 }}>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <Link to={isLogin ? '/register' : '/login'} style={{ color: '#6d5ef6', fontWeight: 700, textDecoration: 'none' }}>{isLogin ? 'Register' : 'Log in'}</Link>
          </p>
        </div>
      </section>
      <style>{`@media(max-width:760px){.auth-grid{grid-template-columns:1fr!important}.auth-grid>section:first-child{display:none!important}}`}</style>
    </main>
  )
}


