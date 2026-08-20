'use client'
import { useState } from 'react'
import { useNavigate } from '../lib/navigation'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [resent, setResent] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])

  const handleDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...code]
    next[i] = val
    setCode(next)
    if (val && i < 5) {
      const el = document.getElementById(`otp-${i + 1}`)
      el?.focus()
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      document.getElementById(`otp-${i - 1}`)?.focus()
    }
  }

  const filled = code.every(d => d !== '')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 48, justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7c6ff7 0%, #5a4ee0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(109,94,246,0.35)' }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>S</span>
          </div>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Studia</span>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '40px 36px' }}>
          {/* Icon */}
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(109,94,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6d5ef6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>

          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Check your email
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.65, marginBottom: 32 }}>
            We sent a 6-digit code to <strong style={{ color: 'var(--color-text-2)', fontWeight: 600 }}>layla@example.com</strong>. Enter it below to verify your account.
          </p>

          {/* OTP input */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
            {code.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
                  color: 'var(--color-text)', background: 'var(--color-surface-2)',
                  border: `2px solid ${digit ? '#6d5ef6' : 'var(--color-border)'}`,
                  borderRadius: 12, outline: 'none', fontFamily: "'Fraunces', Georgia, serif",
                  transition: 'border-color 0.15s',
                  caretColor: '#6d5ef6',
                }}
                onFocus={e => { e.target.style.borderColor = '#6d5ef6'; e.target.style.background = 'var(--color-surface)' }}
                onBlur={e => { if (!digit) e.target.style.borderColor = 'var(--color-border)'; e.target.style.background = 'var(--color-surface-2)' }}
              />
            ))}
          </div>

          <button
            onClick={() => navigate('/onboarding')}
            disabled={!filled}
            style={{ width: '100%', padding: '13px', borderRadius: 12, background: filled ? '#6d5ef6' : 'var(--color-border)', color: filled ? '#fff' : 'var(--color-text-muted)', fontWeight: 700, fontSize: 15, border: 'none', cursor: filled ? 'pointer' : 'not-allowed', transition: 'background 0.15s', marginBottom: 20, boxShadow: filled ? '0 4px 14px rgba(109,94,246,0.35)' : 'none' }}
          >
            Verify email
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setResent(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, color: resent ? 'var(--color-text-muted)' : '#6d5ef6', fontWeight: 500 }}
              disabled={resent}
            >
              {resent ? '✓ Code resent — check your inbox' : "Didn't receive it? Resend code"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-subtle)' }}>
          Wrong email?{' '}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6d5ef6', fontSize: 13, fontWeight: 500 }}>
            Go back
          </button>
        </p>
      </div>
    </div>
  )
}
