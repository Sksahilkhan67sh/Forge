'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { sessions as sessionsApi } from '@/lib/api'
import { useAuthStore, useChatStore, useProjectStore } from '@/lib/store'
import ChatInput from '@/components/chat/ChatInput'

const STARTERS = [
  { icon: '⚡', label: 'Build a REST API', prompt: 'Build a production-ready REST API with FastAPI, JWT auth, Postgres, and rate limiting. Include Dockerfile.' },
  { icon: '🌐', label: 'Full-stack app', prompt: 'Create a full-stack Next.js 15 app with FastAPI backend, Postgres, JWT auth, and a clean dark UI.' },
  { icon: '🐛', label: 'Debug my code', prompt: 'Help me debug this error:' },
  { icon: '⚙️', label: 'Write & run code', prompt: 'Write a Python script that parses a CSV, computes statistics, and generates a summary. Make it production quality.' },
  { icon: '🧪', label: 'Write tests', prompt: 'Write comprehensive pytest tests for my FastAPI application including auth, CRUD, and edge cases.' },
  { icon: '🏗️', label: 'System design', prompt: 'Design the architecture for a scalable SaaS application. Include database schema, API design, and deployment strategy.' },
]

export default function EmptyChat() {
  const { user } = useAuthStore()
  const { addSession, setActiveSession } = useChatStore()
  const { activeProjectId } = useProjectStore()
  const [loading, setLoading] = useState(false)

  const start = async (message: string) => {
    if (!message.trim() || loading) return
    setLoading(true)
    try {
      const session = await sessionsApi.create(activeProjectId || undefined)
      addSession(session)
      setActiveSession(session.id)
      sessionStorage.setItem('forge_initial_message', message)
    } catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', position: 'relative', overflow: 'hidden auto' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 560, paddingRight: 16, animation: 'fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both', position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 20px' }}>⚡</div>
          <h1 style={{ fontSize: 32, fontWeight: 400, color: 'rgba(255,255,255,0.92)', marginBottom: 8, fontFamily: "'Espoir', serif", letterSpacing: '0.05em' }}>
            Hi {firstName} — what are we building?
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.32)', lineHeight: 1.6 }}>
            Production-grade code, not demos. I execute, iterate, and ship.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: 28 }}>
          <ChatInput onSend={start} disabled={loading} />
        </div>

        {/* Starter cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5, width: '100%' }}>
          {STARTERS.map(s => (
            <button
              key={s.label}
              onClick={() => start(s.prompt)}
              style={{
                 textAlign: 'left', padding: '8px 10px',
                background: 'rgba(255,255,255,0.025)',
                border: '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 8, cursor: 'pointer',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(99,102,241,0.06)'); (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)') }}
              onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.025)'); (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)') }}
            >
              <div style={{ fontSize: 13, marginBottom: 3 }}>{s.icon}</div>
              <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginBottom: 1 }}>{s.label}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.prompt}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
