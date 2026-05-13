'use client'

import { useMemo } from 'react'
import { type Message } from '@/lib/api'
import { Zap } from 'lucide-react'

interface Props { messages: Message[] }

export default function TokenUsage({ messages }: Props) {
  const stats = useMemo(() => {
    let totalIn = 0, totalOut = 0, totalLatency = 0, count = 0
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        totalIn += msg.tokens_in || 0
        totalOut += msg.tokens_out || 0
        totalLatency += msg.latency_ms || 0
        count++
      }
    }
    const costUSD = (totalIn / 1_000_000) * 0.05 + (totalOut / 1_000_000) * 0.08
    return { totalIn, totalOut, total: totalIn + totalOut, avgLatency: count > 0 ? Math.round(totalLatency / count) : 0, costUSD, responses: count }
  }, [messages])

  if (stats.total === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-t border-surface-200 bg-surface-50/50 text-[10px] text-zinc-600 font-mono">
      <Zap size={10} className="text-forge-500" />
      <span>{stats.total.toLocaleString()} tokens</span>
      <span>·</span>
      <span>{stats.responses} responses</span>
      <span>·</span>
      <span>avg {stats.avgLatency}ms</span>
      <span>·</span>
      <span className="text-forge-600">${stats.costUSD.toFixed(5)}</span>
    </div>
  )
}