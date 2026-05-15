'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { sessions as sessionsApi, streamChat, type Message } from '@/lib/api'
import { useChatStore, useProjectStore } from '@/lib/store'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

interface Props { sessionId: string }

export default function ChatWindow({ sessionId }: Props) {
  const { messages, setMessages, appendMessage, streaming, setStreaming, streamingText, appendStreamingText, clearStreamingText, sessions } = useChatStore()
  const { activeProjectId } = useProjectStore()
  const [loading, setLoading] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [displayedText, setDisplayedText] = useState('')
  const [lastUserMsg, setLastUserMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const wordQueueRef = useRef<string[]>([])
  const renderingRef = useRef(false)
  const fullStreamRef = useRef('')
  const sessionMessages = messages[sessionId] || []
  const currentSession = sessions.find(s => s.id === sessionId)

  const drainQueue = useCallback(() => {
    if (renderingRef.current) return
    renderingRef.current = true
    const tick = () => {
      if (!wordQueueRef.current.length) { renderingRef.current = false; return }
      const word = wordQueueRef.current.shift()!
      setDisplayedText(p => p + word)
      const delay = word.includes('`') ? 6 : Math.random() * 16 + 8
      setTimeout(tick, delay)
    }
    tick()
  }, [])

  useEffect(() => {
    if (!streamingText) return
    const newText = streamingText.slice(fullStreamRef.current.length)
    fullStreamRef.current = streamingText
    wordQueueRef.current.push(...(newText.match(/\S+\s*/g) || []))
    drainQueue()
  }, [streamingText, drainQueue])

  useEffect(() => {
    if (!streaming) {
      if (wordQueueRef.current.length) { setDisplayedText(fullStreamRef.current); wordQueueRef.current = [] }
      fullStreamRef.current = ''
      setTimeout(() => setDisplayedText(''), 100)
    }
  }, [streaming])

  useEffect(() => { loadMessages() }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessionMessages.length, displayedText])

  const loadMessages = async () => {
    setLoading(true)
    try { const d = await sessionsApi.messages(sessionId); setMessages(sessionId, d) }
    catch { toast.error('Failed to load') }
    finally { setTimeout(() => setLoading(false), 200) }
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    setLastUserMsg(text)
    appendMessage(sessionId, {
      id: crypto.randomUUID(), role: 'user',
      content: { text }, model_used: null,
      tokens_in: null, tokens_out: null,
      created_at: new Date().toISOString(),
    })
    setStreaming(true); setThinking(true)
    clearStreamingText(); setDisplayedText('')
    wordQueueRef.current = []; fullStreamRef.current = ''

    try {
      for await (const event of streamChat({ message: text, session_id: sessionId, project_id: activeProjectId || undefined, use_agent: true })) {
        if (event.type === 'chunk') { setThinking(false); appendStreamingText(event.data) }
        else if (event.type === 'done') {
          await new Promise<void>(res => { const c = () => wordQueueRef.current.length === 0 ? res() : setTimeout(c, 50); c() })
          await loadMessages(); clearStreamingText()
        }
        else if (event.type === 'error') { toast.error(event.data); clearStreamingText(); setThinking(false) }
      }
    } catch (err: any) { toast.error(err.message); clearStreamingText() }
    finally { setStreaming(false); setThinking(false) }
  }, [sessionId, streaming, activeProjectId])

  // Token stats
  const tokenStats = sessionMessages.filter(m => m.role === 'assistant').reduce((acc, m) => ({
    tokens: acc.tokens + ((m as any).tokens_out || 0),
    responses: acc.responses + 1,
    latency: acc.latency + ((m as any).latency_ms || 0),
  }), { tokens: 0, responses: 0, latency: 0 })

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, flexDirection: i % 2 === 0 ? 'row-reverse' : 'row' }}>
            <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '65%' }}>
              <div className="skeleton" style={{ height: 12, width: 60, borderRadius: 3 }} />
              <div className="skeleton" style={{ height: 72, borderRadius: 10, width: i % 2 === 0 ? 200 : 320 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Top bar */}
      <div style={{
        height: 48, borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10,
        background: 'rgba(255,255,255,0.015)', flexShrink: 0,
      }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentSession?.title || 'New chat'}
        </p>
        {streaming && (
          <span style={{
            fontSize: 10, padding: '2px 9px', borderRadius: 99, fontWeight: 500,
            background: 'rgba(99,102,241,0.1)', color: '#818cf8',
            border: '0.5px solid rgba(99,102,241,0.2)',
          }}>generating</span>
        )}
        {/* Export */}
        <button
          onClick={() => {
            const lines = [`# ${currentSession?.title || 'Forge Chat'}`, `> ${new Date().toLocaleString()}`, '']
            sessionMessages.forEach(m => { lines.push(m.role === 'user' ? '## You' : '## Forge'); lines.push(m.content?.text || ''); lines.push('') })
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' })), download: `forge-${Date.now()}.md` })
            a.click(); toast.success('Exported!')
          }}
          style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); (e.currentTarget.style.color = 'rgba(255,255,255,0.6)') }}
          onMouseLeave={e => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = 'rgba(255,255,255,0.22)') }}
          title="Export chat"
        >↓</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {sessionMessages.length === 0 && !streaming && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12, animation: 'fade-in 0.3s ease both' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 30px rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⚡</div>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>What are we building?</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Write production-grade code, debug anything, ship faster</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {['Ctrl+K new chat', 'Ctrl+B sidebar', 'Ctrl+/ focus'].map(s => (
                  <span key={s} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {sessionMessages.map((msg, i) => (
            <div key={msg.id} style={{ animation: `fade-up 0.25s cubic-bezier(0.16,1,0.3,1) ${Math.min(i * 20, 100)}ms both` }}>
              <MessageBubble message={msg} onRegenerate={msg.role === 'assistant' ? () => sendMessage(lastUserMsg) : undefined} />
            </div>
          ))}

          {/* Thinking */}
          {thinking && !displayedText && (
            <div style={{ display: 'flex', gap: 12, animation: 'fade-up 0.2s ease both' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, boxShadow: '0 0 12px rgba(99,102,241,0.3)' }}>⚡</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>Thinking…</span>
              </div>
            </div>
          )}

          {streaming && displayedText && (
            <div style={{ animation: 'fade-in 0.15s ease both' }}>
              <MessageBubble
                message={{ id: 'streaming', role: 'assistant', content: { text: displayedText }, model_used: null, tokens_in: null, tokens_out: null, created_at: new Date().toISOString() }}
                isStreaming
              />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Token bar */}
      {tokenStats.tokens > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 20px', borderTop: '0.5px solid rgba(255,255,255,0.04)', fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>
          <span>{tokenStats.tokens.toLocaleString()} tokens</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{tokenStats.responses} responses</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>avg {tokenStats.responses > 0 ? Math.round(tokenStats.latency / tokenStats.responses) : 0}ms</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: 'rgba(99,102,241,0.5)' }}>${((tokenStats.tokens / 1_000_000) * 0.08).toFixed(5)}</span>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 20px 16px', borderTop: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <ChatInput onSend={sendMessage} disabled={streaming} />
        </div>
      </div>
    </div>
  )
}
