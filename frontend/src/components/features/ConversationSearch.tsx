'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useChatStore } from '@/lib/store'

export default function ConversationSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { sessions, setActiveSession } = useChatStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const filtered = sessions.filter((s) => (s.title || 'New chat').toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 bg-surface-100 hover:bg-surface-200 rounded-lg transition-all mb-2 mx-2"
      style={{ width: 'calc(100% - 16px)' }}>
      <Search size={11} />
      <span>Search chats</span>
      <span className="ml-auto font-mono text-[9px] opacity-50">Ctrl+F</span>
    </button>
  )

  return (
    <div className="px-2 mb-2">
      <div className="relative">
        <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full bg-surface-100 border border-forge-500/30 rounded-lg pl-8 pr-8 py-2 text-xs outline-none text-zinc-300 placeholder:text-zinc-600" />
        <button onClick={() => { setOpen(false); setQuery('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
          <X size={11} />
        </button>
      </div>
      {query && (
        <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
          {filtered.length === 0
            ? <li className="px-3 py-2 text-xs text-zinc-600">No results</li>
            : filtered.map((s) => (
              <li key={s.id}>
                <button onClick={() => { setActiveSession(s.id); setOpen(false); setQuery('') }}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-surface-100 hover:text-zinc-200 rounded-lg transition-all">
                  {s.title || 'New chat'}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}