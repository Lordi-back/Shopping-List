'use client'

import { useEffect } from 'react'

export type ToastType = 'success' | 'warning' | 'info' | 'error'

type ToastProps = {
  id: string
  type: ToastType
  message: string
  onDismiss: (id: string) => void
  duration?: number
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  warning: '⚠️',
  info: '🔔',
  error: '❌',
}

const COLORS: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-orange-50 border-orange-200 text-orange-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  error: 'bg-red-50 border-red-200 text-red-800',
}

export function Toast({ id, type, message, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onDismiss])

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg
        animate-slide-up cursor-pointer
        ${COLORS[type]}
      `}
      onClick={() => onDismiss(id)}
    >
      <span className="text-lg flex-shrink-0">{ICONS[type]}</span>
      <p className="text-sm font-medium flex-1">{message}</p>
      <button className="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0">
        ✕
      </button>
    </div>
  )
}
