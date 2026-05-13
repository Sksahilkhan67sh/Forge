'use client'

import { Download } from 'lucide-react'
import { type Message } from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  messages: Message[]
  sessionTitle?: string
}

export default function ExportChat({ messages, sessionTitle }: Props) {
  const exportMarkdown = () => {
    if (messages.length === 0) { toast.error('No messages to export'); return }

    const lines: string[] = [
      `# ${sessionTitle || 'Forge Chat Export'}`,
      `> Exported on ${new Date().toLocaleString()}`,
      '',
    ]

    for (const msg of messages) {
      lines.push(msg.role === 'user' ? '## You' : '## Forge')
      lines.push(msg.content?.text || '')
      if (msg.model_used) lines.push(`*${msg.model_used} · ${msg.tokens_out || 0} tokens*`)
      lines.push('')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forge-chat-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Chat exported!')
  }

  return (
    <button
      onClick={exportMarkdown}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-100 rounded-lg transition-all"
      title="Export chat as Markdown"
    >
      <Download size={12} />
      Export
    </button>
  )
}