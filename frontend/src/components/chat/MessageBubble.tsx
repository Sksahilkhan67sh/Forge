'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { type Message } from '@/lib/api'

// Minimal dark theme for code
const codeTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': { color: '#c9d1d9', background: 'transparent', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', lineHeight: '1.7' },
  'token.comment': { color: '#8b949e' },
  'token.keyword': { color: '#818cf8' },
  'token.string': { color: '#86efac' },
  'token.function': { color: '#67e8f9' },
  'token.number': { color: '#f9a8d4' },
  'token.operator': { color: '#c9d1d9' },
  'token.punctuation': { color: '#8b949e' },
  'token.class-name': { color: '#fbbf24' },
  'token.builtin': { color: '#818cf8' },
  'token.boolean': { color: '#f9a8d4' },
}

interface Props {
  message: Message
  isStreaming?: boolean
  onRegenerate?: () => void
}

export default function MessageBubble({ message, isStreaming, onRegenerate }: Props) {
  const isUser = message.role === 'user'
  const text = message.content?.text || ''
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{ display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        flexShrink: 0, marginTop: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600,
        ...(isUser
          ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.1)' }
          : { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', boxShadow: '0 0 12px rgba(99,102,241,0.25)' }
        ),
      }}>
        {isUser ? 'U' : '⚡'}
      </div>

      <div style={{ maxWidth: '78%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Name + meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', fontWeight: 500 }}>
            {isUser ? 'You' : 'Forge'}
          </span>
          {!isUser && !isStreaming && message.latency_ms && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>
              {(message.latency_ms / 1000).toFixed(1)}s · {message.tokens_out || 0} tok
            </span>
          )}
        </div>

        {/* Bubble */}
        {isUser ? (
          <div style={{
            padding: '10px 14px', borderRadius: '10px 2px 10px 10px',
            background: 'rgba(99,102,241,0.12)',
            border: '0.5px solid rgba(99,102,241,0.2)',
            fontSize: 13.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.65,
          }}>
            {text}
          </div>
        ) : (
          <div style={{
            padding: '12px 16px', borderRadius: '2px 10px 10px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.07)',
            fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7,
          }}
            className={isStreaming ? 'streaming-cursor' : ''}
          >
            <div className="msg-prose">
              <MarkdownContent content={text} />
            </div>
          </div>
        )}

        {/* Actions */}
        {!isUser && !isStreaming && hovered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 5, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
            {[
              { icon: copied ? '✓' : '⎘', label: 'Copy', action: copy, color: copied ? '#34d399' : undefined },
              { icon: '↺', label: 'Regenerate', action: onRegenerate, hidden: !onRegenerate },
              { icon: '↑', label: 'Good', action: () => setFeedback('up'), color: feedback === 'up' ? '#818cf8' : undefined },
              { icon: '↓', label: 'Bad', action: () => setFeedback('down'), color: feedback === 'down' ? '#f87171' : undefined },
            ].filter(b => !b.hidden).map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.label}
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: 'none', border: 'none',
                  color: btn.color || 'rgba(255,255,255,0.25)',
                  fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); (e.currentTarget.style.color = btn.color || 'rgba(255,255,255,0.65)') }}
                onMouseLeave={e => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = btn.color || 'rgba(255,255,255,0.25)') }}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !className
          if (!isInline && match) {
            return <CodeBlock language={match[1]} code={String(children).replace(/\n$/, '')} />
          }
          return <code className={className}>{children}</code>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const lines = code.split('\n').length

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.08)', margin: '10px 0', background: '#0a0a12' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#ff5f56','#ffbd2e','#27c93f'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{language}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>{lines} lines</span>
          <button
            onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            style={{ fontSize: 11, color: copied ? '#34d399' : 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', transition: 'color 0.15s' }}
          >
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={codeTheme}
        customStyle={{ margin: 0, padding: '14px 16px', background: 'transparent', fontSize: '12.5px', lineHeight: '1.7' }}
        showLineNumbers={lines > 10}
        lineNumberStyle={{ color: 'rgba(255,255,255,0.1)', fontSize: '11px', marginRight: 16 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
