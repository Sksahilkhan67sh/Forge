'use client'

import { cn } from '@/lib/utils'

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-100', className)} style={style} />
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <Skeleton className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 max-w-[85%]">
        <Skeleton className="h-4 w-16 rounded" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-[90%] rounded" />
          <Skeleton className="h-3.5 w-[75%] rounded" />
        </div>
        <div className="mt-3 rounded-lg overflow-hidden border border-surface-200">
          <div className="flex items-center px-4 py-2 bg-surface-100 border-b border-surface-200">
            <Skeleton className="h-3 w-12 rounded" />
          </div>
          <div className="p-4 space-y-1.5 bg-[#111]">
            <Skeleton className="h-3 w-[60%] rounded" />
            <Skeleton className="h-3 w-[80%] rounded" />
            <Skeleton className="h-3 w-[45%] rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SessionListSkeleton() {
  return (
    <ul className="space-y-0.5 px-2">
      {[80,65,90,55,72].map((w, i) => (
        <li key={i} className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-3.5 h-3.5 rounded flex-shrink-0" />
            <Skeleton className="h-3 rounded" style={{ width: `${w}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ProjectListSkeleton() {
  return (
    <ul className="space-y-0.5 px-2">
      {[70,85,60].map((w, i) => (
        <li key={i} className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-3.5 h-3.5 rounded flex-shrink-0" />
            <Skeleton className="h-3 rounded" style={{ width: `${w}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ChatWindowSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-3 flex-row-reverse animate-fade-in">
          <Skeleton className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5" />
          <Skeleton className="h-10 w-48 rounded-2xl rounded-tr-sm" />
        </div>
        <MessageSkeleton />
        <div className="flex gap-3 flex-row-reverse animate-fade-in">
          <Skeleton className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5" />
          <Skeleton className="h-10 w-64 rounded-2xl rounded-tr-sm" />
        </div>
        <MessageSkeleton />
      </div>
    </div>
  )
}

export function UserAvatarSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-2.5 w-32 rounded" />
      </div>
    </div>
  )
}

export default Skeleton