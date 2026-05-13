'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'online' | 'offline' | 'slow'

export default function NetworkBanner() {
  const [status, setStatus] = useState<Status>('online')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => {
      if (!navigator.onLine) { setStatus('offline'); setVisible(true); return }
      const conn = (navigator as any).connection
      if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.rtt > 500)) {
        setStatus('slow'); setVisible(true); return
      }
      setStatus('online')
      setTimeout(() => setVisible(false), 3000)
    }
    window.addEventListener('online', check)
    window.addEventListener('offline', check)
    return () => { window.removeEventListener('online', check); window.removeEventListener('offline', check) }
  }, [])

  if (!visible) return null

  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all',
      status === 'offline' && 'bg-red-500/90 text-white',
      status === 'slow' && 'bg-amber-500/90 text-white',
      status === 'online' && 'bg-forge-500/90 text-white',
    )}>
      {status === 'offline' && <><WifiOff size={13} /><span>No internet connection</span></>}
      {status === 'slow' && <><AlertTriangle size={13} /><span>Slow connection — responses may take longer</span></>}
      {status === 'online' && <><Wifi size={13} /><span>Back online</span></>}
    </div>
  )
}