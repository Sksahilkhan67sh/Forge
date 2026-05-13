'use client'

import { useEffect, useState } from 'react'

const MESSAGES = ['Thinking…', 'Analyzing your request…', 'Writing code…', 'Almost there…']

export default function ThinkingIndicator() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIndex((i) => (i + 1) % MESSAGES.length); setVisible(true) }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex gap-3 animate-slide-up">
      <div className="w-7 h-7 rounded-full bg-forge-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs text-forge-400">⚡</span>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0,1,2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-forge-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }} />
            ))}
          </div>
          <span className="text-xs text-zinc-500 transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }}>
            {MESSAGES[index]}
          </span>
        </div>
        <div className="h-1 w-32 rounded-full bg-surface-200 overflow-hidden">
          <div className="h-full bg-forge-500/40 rounded-full animate-shimmer" />
        </div>
      </div>
    </div>
  )
}