'use client'
import { useState } from 'react'
import { useNavigate } from '../lib/navigation'

type Step = 'request' | 'sent' | 'reset' | 'done'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)

  const strength = pw.length === 0 ? 0 : pw.length < 8 ? 1 : pw.length < 12 ? 2 : /[A-Z]/.test(pw) && /[0-9]/.test(pw) ? 4 : 3
  const strengthLabel = ['', 'Too short', 'Weak', 'Good', 'Strong'][strength]
  const strengthColor = ['', '#c04a2b', '#e8845a', '#5ab58e', '#2e7a59'][strength]

  const EyeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {showPw ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
    </svg>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 48, justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7c6ff7 0%, #5a4ee0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(109,94,246,0.35)' }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: "'Fraunces', Georgia, serif" }}>S</span>
          </div>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Studia</span>
        </div>

        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '40px 36px' }}>

          {/* Step: request */}
          {step === 'request' && (
            <>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(109,94,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6d5ef6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Reset your password</h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.65, marginBottom: 28 }}>Enter the email associated with your account and we'll send you a reset link.</p>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>Email address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="layla@example.com"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--color-border)', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-surface-2)', outline: 'none', boxSizing: 'border-box', marginBottom: 20, transition: 'border-color 0.15s' }}
                onFocus={e => { e.target.style.borderColor = '#6d5ef6'; e.target.style.background = 'var(--color-surface)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.background = 'var(--color-surface-2)' }}
              />
              <button onClick={() => setStep('sent')} disabled={!email.includes('@')} style={{ width: '100%', padding: '13px', borderRadius: 12, background: email.includes('@') ? '#6d5ef6' : 'var(--color-border)', color: email.includes('@') ? '#fff' : 'var(--color-text-muted)', fontWeight: 700, fontSize: 15, border: 'none', cursor: email.includes('@') ? 'pointer' : 'not-allowed', boxShadow: email.includes('@') ? '0 4px 14px rgba(109,94,246,0.35)' : 'none', transition: 'background 0.15s' }}>
                Send reset link
              </button>
            </>
          )}

          {/* Step: sent */}
          {step === 'sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(90,181,142,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5ab58e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 10 }}>Check your inbox</h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 28 }}>
                We sent a reset link to <strong style={{ color: 'var(--color-text-2)', fontWeight: 600 }}>{email}</strong>. It expires in 30 minutes.
              </p>
              {/* Simulate clicking the link */}
              <button onClick={() => setStep('reset')} style={{ width: '100%', padding: '13px', borderRadius: 12, background: '#6d5ef6', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,94,246,0.35)', marginBottom: 14 }}>
                Open reset link ↗
              </button>
              <button onClick={() => setStep('request')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Resend email
              </button>
            </div>
          )}

          {/* Step: new password */}
          {step === 'reset' && (
            <>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(109,94,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6d5ef6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Choose a new password</h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 28 }}>Must be at least 8 characters.</p>

              {[{ label: 'New password', val: pw, set: setPw }, { label: 'Confirm password', val: pw2, set: setPw2 }].map(({ label, val, set }, fi) => (
                <div key={fi} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)}
                      style={{ width: '100%', padding: '11px 44px 11px 14px', borderRadius: 11, border: `1px solid ${fi === 1 && pw2 && pw !== pw2 ? '#c04a2b' : 'var(--color-border)'}`, fontSize: 14, color: 'var(--color-text)', background: 'var(--color-surface-2)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                      onFocus={e => { e.target.style.borderColor = '#6d5ef6'; e.target.style.background = 'var(--color-surface)' }}
                      onBlur={e => { e.target.style.borderColor = fi === 1 && pw2 && pw !== pw2 ? '#c04a2b' : 'var(--color-border)'; e.target.style.background = 'var(--color-surface-2)' }}
                    />
                    {fi === 0 && <button onClick={() => setShowPw(p => !p)} type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}><EyeIcon /></button>}
                  </div>
                  {fi === 0 && pw && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
                      {[1,2,3,4].map(n => <div key={n} style={{ height: 3, flex: 1, borderRadius: 2, background: n <= strength ? strengthColor : 'var(--color-border)', transition: 'background 0.2s' }} />)}
                      <span style={{ fontSize: 11, color: strengthColor, fontWeight: 600, marginLeft: 4, whiteSpace: 'nowrap' }}>{strengthLabel}</span>
                    </div>
                  )}
                  {fi === 1 && pw2 && pw !== pw2 && <p style={{ fontSize: 11.5, color: '#c04a2b', marginTop: 5 }}>Passwords don't match</p>}
                </div>
              ))}

              <button
                onClick={() => setStep('done')}
                disabled={!pw || pw.length < 8 || pw !== pw2}
                style={{ width: '100%', padding: '13px', borderRadius: 12, marginTop: 8, background: pw && pw.length >= 8 && pw === pw2 ? '#6d5ef6' : 'var(--color-border)', color: pw && pw.length >= 8 && pw === pw2 ? '#fff' : 'var(--color-text-muted)', fontWeight: 700, fontSize: 15, border: 'none', cursor: pw && pw.length >= 8 && pw === pw2 ? 'pointer' : 'not-allowed', boxShadow: pw && pw.length >= 8 && pw === pw2 ? '0 4px 14px rgba(109,94,246,0.35)' : 'none', transition: 'background 0.15s' }}
              >
                Set new password
              </button>
            </>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(90,181,142,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5ab58e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 10 }}>Password updated</h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 28 }}>Your password has been changed. All other sessions have been signed out for security.</p>
              <button onClick={() => navigate('/app')} style={{ width: '100%', padding: '13px', borderRadius: 12, background: '#6d5ef6', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,94,246,0.35)' }}>
                Sign in to Studia
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-subtle)' }}>
          Remember your password?{' '}
          <button onClick={() => navigate('/app')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6d5ef6', fontSize: 13, fontWeight: 500 }}>Sign in</button>
        </p>
      </div>
    </div>
  )
}
