'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
}

const PROMPTS = [
  'Build a REST API with FastAPI and JWT auth',
  'Debug this error and explain the fix',
  'Create a full-stack Next.js app with Postgres',
  'Write tests for this function',
]

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const [useAgent, setUseAgent] = useState(true)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [value])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSend = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div>
      {/* Input box */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${focused ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.09)'}`,
        borderRadius: 12, overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.06)' : 'none',
      }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          disabled={disabled}
          placeholder={disabled ? 'Forge is generating…' : 'Message Forge… (Enter to send, Shift+Enter for newline)'}
          rows={1}
          style={{
            width: '100%', padding: '13px 16px 8px',
            background: 'transparent', border: 'none', resize: 'none',
            fontSize: 13.5, color: 'rgba(255,255,255,0.8)',
            fontFamily: 'inherit', lineHeight: 1.6,
            maxHeight: 180,
          }}
        />

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 10px', gap: 6 }}>
          {/* Agent toggle */}
          <button
            onClick={() => setUseAgent(a => !a)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 99,
              background: useAgent ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${useAgent ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)'}`,
              color: useAgent ? '#818cf8' : 'rgba(255,255,255,0.3)',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            <span>⚡</span>
            Agent
          </button>

          <div style={{ flex: 1 }} />

          {value.length > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
              {value.length}
            </span>
          )}

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            style={{
              width: 30, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, cursor: value.trim() && !disabled ? 'pointer' : 'not-allowed',
              border: '0.5px solid',
              transition: 'all 0.15s',
              ...(disabled
                ? { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' }
                : value.trim()
                  ? { background: 'rgba(99,102,241,0.85)', borderColor: 'rgba(99,102,241,0.5)', color: 'white', boxShadow: '0 0 12px rgba(99,102,241,0.2)' }
                  : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' }
              ),
            }}
          >
            {disabled ? '■' : '↑'}
          </button>
        </div>
      </div>

      {/* Hint */}
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', textAlign: 'center', marginTop: 8 }}>
        Ctrl+/ to focus · Shift+Enter for newline · Enter to send
      </p>
    </div>
  )
}
