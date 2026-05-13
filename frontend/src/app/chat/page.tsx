'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, useChatStore } from '@/lib/store'
import ChatWindow from '@/components/chat/ChatWindow'
import EmptyChat from '@/components/chat/EmptyChat'

export default function ChatPage() {
  const router = useRouter()
  const user = useAuthStore(s => s.user)
  const activeSessionId = useChatStore(s => s.activeSessionId)

  useEffect(() => { if (!user) router.replace('/auth') }, [user, router])
  if (!user) return null

  return activeSessionId ? <ChatWindow sessionId={activeSessionId} /> : <EmptyChat />
}
