'use client'

import { useState, useEffect } from 'react'
import { getReminders, Reminder } from '@/lib/prediction-engine'

type ReminderBannerProps = {
  onAddItem: (name: string) => void
  onDismiss: () => void
}

export function ReminderBanner({ onAddItem, onDismiss }: ReminderBannerProps) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    loadReminders()
  }, [])

  const loadReminders = async () => {
    const data = await getReminders('demo-user') // замени на реальный userId
    setReminders(data.slice(0, 3)) // не больше 3 напоминаний
  }

  if (reminders.length === 0 || dismissed.length === reminders.length) return null

  return (
    <div className="card bg-warm-50 border border-warm-200 mb-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-warm-800 mb-2">
            Умные напоминания
          </h4>
          <div className="space-y-2">
            {reminders
              .filter(r => !dismissed.includes(r.product_name))
              .map(reminder => (
                <div
                  key={reminder.product_name}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-warm-700 truncate">
                      {reminder.product_name}
                    </p>
                    <p className="text-xs text-warm-500">
                      {reminder.message} · {(reminder.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        onAddItem(reminder.product_name)
                        setDismissed(prev => [...prev, reminder.product_name])
                      }}
                      className="btn btn-primary text-xs py-1 px-3"
                    >
                      + В список
                    </button>
                    <button
                      onClick={() =>
                        setDismissed(prev => [...prev, reminder.product_name])
                      }
                      className="btn btn-ghost text-xs py-1 px-2"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
        {reminders.every(r => dismissed.includes(r.product_name)) && (
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
