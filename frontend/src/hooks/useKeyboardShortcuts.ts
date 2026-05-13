'use client'

import { useEffect } from 'react'
import { useChatStore } from '@/lib/store'
import { sessions as sessionsApi } from '@/lib/api'

export function useKeyboardShortcuts() {
  const { addSession, setActiveSession } = useChatStore()

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'k') {
        e.preventDefault()
        try {
          const session = await sessionsApi.create()
          addSession(session)
          setActiveSession(session.id)
        } catch {}
      }

      if (ctrl && e.key === '/') {
        e.preventDefault()
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Message"]')
        textarea?.focus()
      }

      if (e.key === 'Escape') {
        document.querySelector<HTMLTextAreaElement>('textarea')?.blur()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addSession, setActiveSession])
}