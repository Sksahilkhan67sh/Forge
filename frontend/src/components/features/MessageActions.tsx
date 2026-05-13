'use client'

import { useState } from 'react'
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { toast } from 'sonner'
import { type Message } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props { message: Message; onRegenerate?: () => void }

export default function MessageActions({ message, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const text = message.content?.text || ''

  const copyMessage = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={copyMessage} className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-surface-100 rounded-md transition-all" title="Copy">
        {copied ? <Check size={12} className="text-forge-400" /> : <Copy size={12} />}
      </button>
      {onRegenerate && (
        <button onClick={onRegenerate} className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-surface-100 rounded-md transition-all" title="Regenerate">
          <RefreshCw size={12} />
        </button>
      )}
      <div className="w-px h-3 bg-surface-300 mx-0.5" />
      <button onClick={() => setFeedback('up')} className={cn('p-1.5 rounded-md transition-all', feedback === 'up' ? 'text-forge-400 bg-forge-500/10' : 'text-zinc-600 hover:text-zinc-300 hover:bg-surface-100')}>
        <ThumbsUp size={12} />
      </button>
      <button onClick={() => setFeedback('down')} className={cn('p-1.5 rounded-md transition-all', feedback === 'down' ? 'text-red-400 bg-red-500/10' : 'text-zinc-600 hover:text-zinc-300 hover:bg-surface-100')}>
        <ThumbsDown size={12} />
      </button>
    </div>
  )
}