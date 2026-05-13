'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { auth, saveToken } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export default function AuthPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })

  useEffect(() => {
    const saved = localStorage.getItem('forge_remembered_email')
    if (saved) { setForm(f => ({ ...f, email: saved })); setRememberMe(true) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = mode === 'register'
        ? await auth.register(form.email, form.password, form.full_name || undefined)
        : await auth.login(form.email, form.password)
      if (rememberMe) localStorage.setItem('forge_remembered_email', form.email)
      else localStorage.removeItem('forge_remembered_email')
      saveToken(result.access_token)
      const user = await auth.me()
      setAuth(user, result.access_token)
      router.push('/chat')
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 10, fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'all 0.15s', outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '60vh', background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '10%', width: '40vw', height: '40vh', background: 'radial-gradient(ellipse, rgba(139,92,246,0.04) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 54, height: 54, margin: '0 auto 18px', borderRadius: 16, background: 'linear-gradient(145deg, #1a1a2e, #16213e)', border: '0.5px solid rgba(99,102,241,0.3)', boxShadow: '0 0 0 1px rgba(99,102,241,0.1), 0 8px 32px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -8, left: -8, right: -8, height: '50%', background: 'radial-gradient(ellipse, rgba(99,102,241,0.25) 0%, transparent 70%)' }} />
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ position: 'relative', zIndex: 1 }}>
              <path d="M7 6h14M7 14h9M7 22V6" stroke="url(#g1)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="g1" x1="7" y1="6" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8"/><stop offset="1" stopColor="#a78bfa"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.05em', marginBottom: 6, fontFamily: "'Espoir', serif" }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.32)' }}>
            {mode === 'login' ? 'Sign in to Forge to continue' : 'Start building with AI today'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.032)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {mode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>Full name</label>
                  <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ada Lovelace" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>Email address</label>
                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@company.com" style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 characters" style={{ ...inputStyle, paddingRight: 44 }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.28)', fontSize: 15, padding: 2, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}
                  >
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              {mode === 'login' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: -4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setRememberMe(r => !r)}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${rememberMe ? '#6366f1' : 'rgba(255,255,255,0.18)'}`, background: rememberMe ? '#6366f1' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0, boxShadow: rememberMe ? '0 0 10px rgba(99,102,241,0.35)' : 'none' }}>
                      {rememberMe && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', userSelect: 'none' }}>Remember me</span>
                  </label>
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                style={{ marginTop: 6, padding: '12px', background: loading ? 'rgba(99,102,241,0.35)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: '0.5px solid rgba(99,102,241,0.4)', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.3)', letterSpacing: '0.01em' }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget.style.transform = 'translateY(-1px)'); (e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.4)') } }}
                onMouseLeave={e => { (e.currentTarget.style.transform = 'none'); (e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(99,102,241,0.3)') }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Signing in…
                  </span>
                ) : mode === 'login' ? 'Sign in to Forge' : 'Create account'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 20px' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>or</span>
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
              style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
              onMouseLeave={e => (e.currentTarget.style.color = '#818cf8')}
            >
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 11.5, color: 'rgba(255,255,255,0.12)' }}>
          Forge · AI Coding Platform · Production-grade software with AI
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.18) !important; }
      `}</style>
    </div>
  )
}
