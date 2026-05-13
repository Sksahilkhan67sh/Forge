'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sessions as sessionsApi, projects as projectsApi } from '@/lib/api'
import { useAuthStore, useChatStore, useProjectStore } from '@/lib/store'

type Tab = 'chats' | 'projects' | 'settings'

const SHORTCUTS = [
  { keys: 'Ctrl+B', label: 'Toggle sidebar' },
  { keys: 'Ctrl+K', label: 'New chat' },
  { keys: 'Ctrl+F', label: 'Search chats' },
  { keys: 'Ctrl+/', label: 'Focus input' },
  { keys: 'Escape', label: 'Close / blur' },
]

export default function Sidebar() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { sessions, setSessions, activeSessionId, setActiveSession, addSession } = useChatStore()
  const { projects, setProjects, activeProjectId, setActiveProject } = useProjectStore()

  const [tab, setTab] = useState<Tab>('chats')
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [creatingChat, setCreatingChat] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
    loadProjects()
  }, [])

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'b') { e.preventDefault(); setOpen(o => !o) }
      if (ctrl && e.key === 'k') { e.preventDefault(); newChat() }
      if (ctrl && e.key === 'f') { e.preventDefault(); setTab('chats'); setSearching(true) }
      if (ctrl && e.key === '/') {
        e.preventDefault()
        document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const loadSessions = async () => {
    try { const d = await sessionsApi.list(); setSessions(d) } catch {}
    finally { setLoadingSessions(false) }
  }

  const loadProjects = async () => {
    try { const d = await projectsApi.list(); setProjects(d) } catch {}
  }

  const newChat = async () => {
    if (creatingChat) return
    setCreatingChat(true)
    try {
      const s = await sessionsApi.create()
      addSession(s)
      setActiveSession(s.id)
    } catch (err: any) { toast.error(err.message) }
    finally { setCreatingChat(false) }
  }

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      const token = localStorage.getItem('forge_token')
      await fetch(`http://localhost:8000/api/v1/chat/sessions/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      setSessions(sessions.filter(s => s.id !== id))
      if (activeSessionId === id) setActiveSession(null)
      toast.success('Deleted')
    } catch { toast.error('Failed') }
    finally { setDeletingId(null) }
  }

  const filtered = sessions.filter(s =>
    (s.title || 'New chat').toLowerCase().includes(search.toLowerCase())
  )

  // Group sessions by date
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const todaySessions = filtered.filter(s => new Date(s.created_at).toDateString() === today)
  const yesterdaySessions = filtered.filter(s => new Date(s.created_at).toDateString() === yesterday)
  const olderSessions = filtered.filter(s => {
    const d = new Date(s.created_at).toDateString()
    return d !== today && d !== yesterday
  })

  const renderGroup = (label: string, list: typeof sessions) => {
    if (!list.length) return null
    return (
      <>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '10px 8px 4px', fontWeight: 500 }}>
          {label}
        </p>
        {list.map(session => (
          <div
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className="group"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
              marginBottom: 1,
              background: activeSessionId === session.id ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: activeSessionId === session.id ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.38)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              if (activeSessionId !== session.id) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'
              }
            }}
            onMouseLeave={e => {
              if (activeSessionId !== session.id) {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)'
              }
            }}
          >
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: activeSessionId === session.id ? '#6366f1' : 'rgba(255,255,255,0.12)',
            }} />
            <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.title || 'New chat'}
            </span>
            <button
              onClick={e => deleteSession(e, session.id)}
              style={{
                opacity: 0, width: 18, height: 18, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,100,100,0.6)', fontSize: 11,
                transition: 'opacity 0.15s',
              }}
              className="group-hover:opacity-100"
              onMouseOver={e => (e.currentTarget.style.opacity = '1')}
              onMouseOut={e => (e.currentTarget.style.opacity = '0')}
            >
              {deletingId === session.id ? '…' : '✕'}
            </button>
          </div>
        ))}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      {/* Icon rail */}
      <div style={{
        width: 52, background: 'rgba(255,255,255,0.02)',
        borderRight: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 0', gap: 4, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 0 20px rgba(99,102,241,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'white', fontWeight: 700, marginBottom: 14,
        }}>F</div>

        {(['chats', 'projects', 'settings'] as const).map((t) => {
          const icons: Record<Tab, string> = { chats: '💬', projects: '📁', settings: '⚙️' }
          const isActive = tab === t && open
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setOpen(true) }}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
              style={{
                width: 36, height: 36, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, transition: 'all 0.12s',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                boxShadow: isActive ? 'inset 0 0 0 0.5px rgba(99,102,241,0.3)' : 'none',
                color: isActive ? '#818cf8' : 'rgba(255,255,255,0.28)',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)') }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = 'transparent') }}
            >
              {icons[t]}
            </button>
          )
        })}

        <div style={{ flex: 1 }} />

        {/* Toggle sidebar */}
        <button
          onClick={() => setOpen(o => !o)}
          title="Toggle sidebar (Ctrl+B)"
          style={{
            width: 36, height: 36, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: 'rgba(255,255,255,0.25)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); (e.currentTarget.style.color = 'rgba(255,255,255,0.6)') }}
          onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = 'rgba(255,255,255,0.25)') }}
        >
          ☰
        </button>

        {/* User avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: 'white', fontWeight: 600,
          marginTop: 4, cursor: 'pointer',
        }}
          onClick={() => { logout(); router.push('/auth') }}
          title="Sign out"
        >
          {user?.email?.[0]?.toUpperCase()}
        </div>
      </div>

      {/* Panel */}
      {open && (
        <div style={{
          width: 220, borderRight: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.015)',
          animation: 'fade-in 0.2s ease both',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 14px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 10 }}>
              {tab === 'chats' ? 'Conversations' : tab === 'projects' ? 'Projects' : 'Settings'}
            </p>

            {tab === 'chats' && (
              <button
                onClick={newChat}
                disabled={creatingChat}
                style={{
                  width: '100%', padding: '7px 10px',
                  background: 'rgba(99,102,241,0.1)',
                  border: '0.5px solid rgba(99,102,241,0.2)',
                  borderRadius: 7, color: '#818cf8',
                  fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                  cursor: creatingChat ? 'not-allowed' : 'pointer',
                  fontFamily: 'EspoirRounded', serif: 'all 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
              >
                <span style={{ fontSize: 14 }}>{creatingChat ? '…' : '+'}</span>
                New chat
                <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.4, fontFamily: 'monospace' }}>⌘K</span>
              </button>
            )}
          </div>

          {/* Search */}
          {tab === 'chats' && (
            <div style={{ padding: '8px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${searching ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 7, transition: 'border-color 0.15s',
              }}>
                <span style={{ fontSize: 12, opacity: 0.4 }}>🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearching(true)}
                  onBlur={() => setSearching(false)}
                  placeholder="Search chats..."
                  style={{
                    flex: 1, background: 'none', border: 'none',
                    fontSize: 12, color: 'rgba(255,255,255,0.6)',
                    fontFamily: 'inherit',
                  }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
            {tab === 'chats' && (
              loadingSessions ? (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[70, 55, 80, 60, 45].map((w, i) => (
                    <div key={i} className="skeleton" style={{ height: 12, width: `${w}%`, borderRadius: 4 }} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                    {search ? 'No results' : 'No chats yet'}
                  </p>
                  {!search && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.12)', marginTop: 4 }}>Ctrl+K to start</p>}
                </div>
              ) : (
                <>
                  {renderGroup('Today', todaySessions)}
                  {renderGroup('Yesterday', yesterdaySessions)}
                  {renderGroup('Earlier', olderSessions)}
                </>
              )
            )}

            {tab === 'projects' && (
              projects.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>No projects</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.12)', marginTop: 4 }}>Index your codebase for RAG</p>
                </div>
              ) : projects.map(p => (
                <div key={p.id}
                  onClick={() => setActiveProject(p.id)}
                  style={{
                    padding: '8px 8px', borderRadius: 6, cursor: 'pointer',
                    marginBottom: 1,
                    background: activeProjectId === p.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>📁</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                    {p.indexed && (
                      <span style={{
                        fontSize: 9, padding: '2px 5px', borderRadius: 99,
                        background: 'rgba(16,185,129,0.1)', color: '#34d399',
                        border: '0.5px solid rgba(16,185,129,0.2)', fontFamily: 'monospace',
                      }}>idx</span>
                    )}
                  </div>
                </div>
              ))
            )}

            {tab === 'settings' && (
              <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Model */}
                <div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>Model</p>
                  <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.07)',
                    borderRadius: 8, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 7,
                      background: 'rgba(99,102,241,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>🧠</div>
                    <div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Llama 3.3 70B</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Groq · Free</p>
                    </div>
                    <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                  </div>
                </div>

                {/* Shortcuts */}
                <div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>Shortcuts</p>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                    {SHORTCUTS.map(({ keys, label }, i) => (
                      <div key={keys} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 12px',
                        borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
                        <kbd style={{
                          fontSize: 9, fontFamily: 'monospace',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.4)',
                          padding: '2px 6px', borderRadius: 4,
                        }}>{keys}</kbd>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stack */}
                <div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>Stack</p>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                    {[['Frontend','Next.js 15'],['Backend','FastAPI'],['DB','Postgres + pgvector'],['Cache','Redis'],['Agent','LangGraph'],['AI','Groq (free)']].map(([k,v],i) => (
                      <div key={k} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 12px',
                        borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{k}</span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sign out */}
                <button
                  onClick={() => { logout(); router.push('/auth') }}
                  style={{
                    padding: '8px', borderRadius: 7,
                    background: 'rgba(239,68,68,0.08)',
                    border: '0.5px solid rgba(239,68,68,0.15)',
                    color: 'rgba(239,68,68,0.7)',
                    fontSize: 12, fontFamily: 'inherit',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(239,68,68,0.14)') }}
                  onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(239,68,68,0.08)') }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* User footer */}
          {tab !== 'settings' && (
            <div style={{ padding: '12px 14px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: 'white', fontWeight: 600,
                }}>
                  {user?.email?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.full_name || user?.email}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
