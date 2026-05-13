'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Menu, X, Zap, Plus, MessageSquare, FolderOpen, LogOut,
  Trash2, Search, Settings, Cpu,
} from 'lucide-react'
import { sessions as sessionsApi, projects as projectsApi } from '@/lib/api'
import { useAuthStore, useChatStore, useProjectStore } from '@/lib/store'
import { SessionListSkeleton, ProjectListSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

export default function HamburgerMenu() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { sessions, setSessions, activeSessionId, setActiveSession, addSession } = useChatStore()
  const { projects, setProjects, activeProjectId, setActiveProject } = useProjectStore()

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'chats' | 'projects' | 'settings'>('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [creatingChat, setCreatingChat] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSessions()
    loadProjects()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'b') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
      if (ctrl && e.key === 'f') { e.preventDefault(); setOpen(true); setTab('chats'); setSearching(true) }
      if (ctrl && e.key === 'k') { e.preventDefault(); await newChat() }
      if (ctrl && e.key === '/') {
        e.preventDefault()
        document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Message"]')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (searching && searchRef.current) setTimeout(() => searchRef.current?.focus(), 100)
  }, [searching])

  const loadSessions = async () => {
    try { const d = await sessionsApi.list(); setSessions(d) } catch {}
    finally { setLoadingSessions(false) }
  }

  const loadProjects = async () => {
    try { const d = await projectsApi.list(); setProjects(d) } catch {}
    finally { setLoadingProjects(false) }
  }

  const newChat = async () => {
    if (creatingChat) return
    setCreatingChat(true)
    try {
      const session = await sessionsApi.create(activeProjectId || undefined)
      addSession(session)
      setActiveSession(session.id)
      setOpen(false)
    } catch (err: any) { toast.error(err.message) }
    finally { setCreatingChat(false) }
  }

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (deletingId === sessionId) return
    setDeletingId(sessionId)
    try {
      const token = localStorage.getItem('forge_token')
      await fetch(`http://localhost:8000/api/v1/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setSessions(sessions.filter(s => s.id !== sessionId))
      if (activeSessionId === sessionId) setActiveSession(null)
      toast.success('Chat deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeletingId(null) }
  }

  const filteredSessions = sessions.filter(s =>
    (s.title || 'New chat').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const SHORTCUTS = [
    { keys: 'Ctrl+B', label: 'Toggle menu' },
    { keys: 'Ctrl+K', label: 'New chat' },
    { keys: 'Ctrl+F', label: 'Search chats' },
    { keys: 'Ctrl+/', label: 'Focus input' },
    { keys: 'Escape', label: 'Close menu' },
  ]

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed top-4 left-4 z-50 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg',
          open
            ? 'bg-forge-500 text-white scale-95'
            : 'bg-surface-50 border border-surface-200 text-zinc-400 hover:text-zinc-200 hover:border-forge-500/30 hover:scale-105'
        )}
        title="Menu (Ctrl+B)"
      >
        <div className={cn('transition-transform duration-300', open && 'rotate-90')}>
          {open ? <X size={16} /> : <Menu size={16} />}
        </div>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        ref={menuRef}
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-surface-50 border-r border-surface-200 flex flex-col shadow-2xl transition-all duration-300 ease-out',
          open ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-forge-500 flex items-center justify-center shadow-lg shadow-forge-500/30">
              <Zap size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Forge</p>
              <p className="text-[10px] text-zinc-600">AI Coding Platform</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg hover:bg-surface-200 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* New chat button */}
        <div className="px-4 py-3 border-b border-surface-200">
          <button
            onClick={newChat}
            disabled={creatingChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-forge-500 hover:bg-forge-400 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-forge-500/20"
          >
            <Plus size={15} className={creatingChat ? 'animate-spin' : ''} />
            New Chat
            <span className="ml-auto text-[10px] opacity-60 font-mono">Ctrl+K</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-200">
          {([
            { id: 'chats', label: 'Chats', icon: MessageSquare },
            { id: 'projects', label: 'Projects', icon: FolderOpen },
            { id: 'settings', label: 'Settings', icon: Settings },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setSearching(false) }}
              className={cn(
                'flex-1 py-2.5 text-[11px] font-medium transition-all flex flex-col items-center gap-0.5',
                tab === id
                  ? 'text-forge-400 border-b-2 border-forge-500 -mb-px'
                  : 'text-zinc-600 hover:text-zinc-400'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* CHATS */}
          {tab === 'chats' && (
            <div className="py-2">
              <div className="px-3 mb-2">
                {searching ? (
                  <div className="relative">
                    <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      ref={searchRef}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search conversations..."
                      className="w-full bg-surface-100 border border-forge-500/30 rounded-lg pl-8 pr-8 py-2 text-xs outline-none text-zinc-300 placeholder:text-zinc-600"
                    />
                    <button onClick={() => { setSearching(false); setSearchQuery('') }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setSearching(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 bg-surface-100 hover:bg-surface-200 rounded-lg transition-all">
                    <Search size={11} />
                    <span>Search chats</span>
                    <span className="ml-auto font-mono text-[9px] opacity-50">Ctrl+F</span>
                  </button>
                )}
              </div>

              {loadingSessions ? <SessionListSkeleton /> : (
                filteredSessions.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <MessageSquare size={20} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-600">{searchQuery ? 'No results' : 'No chats yet'}</p>
                    {!searchQuery && <p className="text-[10px] text-zinc-700 mt-1">Press Ctrl+K to start</p>}
                  </div>
                ) : (
                  <ul className="space-y-0.5 px-2">
                    {filteredSessions.map(session => (
                      <li key={session.id}>
                        <div
                          onClick={() => { setActiveSession(session.id); setOpen(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2 group cursor-pointer',
                            activeSessionId === session.id
                              ? 'bg-forge-500/10 text-forge-300'
                              : 'text-zinc-400 hover:bg-surface-100 hover:text-zinc-200'
                          )}
                        >
                          <MessageSquare size={12} className="flex-shrink-0 opacity-60" />
                          <span className="truncate flex-1 text-xs">{session.title || 'New chat'}</span>
                          <button
                            onClick={e => deleteSession(e, session.id)}
                            disabled={deletingId === session.id}
                            className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 text-zinc-600 transition-all"
                          >
                            {deletingId === session.id
                              ? <span className="w-2.5 h-2.5 border border-red-400 border-t-transparent rounded-full animate-spin block" />
                              : <Trash2 size={11} />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          )}

          {/* PROJECTS */}
          {tab === 'projects' && (
            <div className="py-2">
              {loadingProjects ? <ProjectListSkeleton /> : (
                projects.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <FolderOpen size={20} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-600">No projects yet</p>
                    <p className="text-[10px] text-zinc-700 mt-1">Index your codebase for RAG</p>
                  </div>
                ) : (
                  <ul className="space-y-0.5 px-2">
                    {projects.map(project => (
                      <li key={project.id}>
                        <button
                          onClick={() => { setActiveProject(project.id); setOpen(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5',
                            activeProjectId === project.id
                              ? 'bg-forge-500/10 text-forge-300'
                              : 'text-zinc-400 hover:bg-surface-100 hover:text-zinc-200'
                          )}
                        >
                          <FolderOpen size={12} className="flex-shrink-0 opacity-60" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{project.name}</p>
                            {project.language && <p className="text-[10px] text-zinc-600">{project.language}</p>}
                          </div>
                          {project.indexed && (
                            <span className="text-[9px] text-forge-500 font-mono bg-forge-500/10 px-1.5 py-0.5 rounded">idx</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          )}

          {/* SETTINGS */}
          {tab === 'settings' && (
            <div className="py-3 px-3 space-y-4">

              {/* Model */}
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 mb-1.5">Model</p>
                <div className="bg-surface-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-forge-500/10 flex items-center justify-center">
                    <Cpu size={14} className="text-forge-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-300 font-medium">Llama 3.3 70B</p>
                    <p className="text-[10px] text-zinc-600">Groq · Free tier</p>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full bg-forge-400 animate-pulse" />
                </div>
              </div>

              {/* Shortcuts */}
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 mb-1.5">Keyboard Shortcuts</p>
                <div className="bg-surface-100 rounded-xl overflow-hidden divide-y divide-surface-200">
                  {SHORTCUTS.map(({ keys, label }) => (
                    <div key={keys} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-zinc-500">{label}</span>
                      <kbd className="text-[10px] font-mono bg-surface-200 text-zinc-400 px-2 py-0.5 rounded-md">{keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* About */}
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider px-2 mb-1.5">About</p>
                <div className="bg-surface-100 rounded-xl overflow-hidden divide-y divide-surface-200">
                  {[
                    ['Version', '0.1.0'],
                    ['Frontend', 'Next.js 15'],
                    ['Backend', 'FastAPI'],
                    ['Database', 'Postgres + pgvector'],
                    ['Cache', 'Redis'],
                    ['Agent', 'LangGraph'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-zinc-500">{k}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* User footer */}
        <div className="border-t border-surface-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-forge-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-forge-500/20">
              <span className="text-sm text-forge-400 font-semibold">{user?.email?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 font-medium truncate">{user?.full_name || user?.email}</p>
              <p className="text-[10px] text-zinc-600 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => { logout(); router.push('/auth') }}
              className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-all"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}