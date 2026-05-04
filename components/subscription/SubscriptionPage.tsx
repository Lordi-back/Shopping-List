'use client'

import { useState, useEffect } from 'react'
import { checkSubscription, joinSubscriptionByCode, mockPayment, formatDate, getDeviceId } from '@/lib/subscription'

type SubscriptionInfo = {
  active: boolean
  code?: string
  validUntil?: string
  devicesUsed?: number
  maxDevices?: number
}

export function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionInfo>({ active: false })
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joinMessage, setJoinMessage] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isPaying, setIsPaying] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    setLoading(true)
    const info = await checkSubscription()
    setSub(info)
    setLoading(false)
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setIsJoining(true)
    setJoinMessage('')

    const result = await joinSubscriptionByCode(joinCode.trim())
    setJoinMessage(result.message)

    if (result.success) {
      await loadSubscription()
      setJoinCode('')
    }
    setIsJoining(false)
  }

  const handlePay = async () => {
    setIsPaying(true)
    // Заглушка оплаты
    const result = await mockPayment('demo-user')
    if (result.success) {
      await loadSubscription()
    }
    setIsPaying(false)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="card animate-pulse p-8 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-2xl mx-auto mb-4" />
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto mb-2" />
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto" />
        </div>
      </div>
    )
  }

  // Активная подписка
  if (sub.active) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="card p-6 text-center">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Premium активен!</h2>
          <p className="text-sm text-gray-500 mb-6">До {formatDate(sub.validUntil!)}</p>

          {/* Код */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <p className="text-xs text-gray-400 mb-2">Код для других устройств</p>
            <div className="flex items-center justify-center gap-3">
              <code className="text-2xl font-bold text-fridge-500 tracking-widest">{sub.code}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sub.code || '')
                  alert('Код скопирован!')
                }}
                className="btn btn-ghost p-2 text-lg"
              >
                📋
              </button>
            </div>
          </div>

          {/* Устройства */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-sm text-gray-500">
              📱 {sub.devicesUsed} из {sub.maxDevices} устройств
            </span>
          </div>

          {/* Индикатор устройств */}
          <div className="flex justify-center gap-1 mb-6">
            {Array.from({ length: sub.maxDevices || 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < (sub.devicesUsed || 0) ? 'bg-fridge-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

         <button
            onClick={async () => {
              setIsPaying(true)
              await mockPayment('demo-user')
              await loadSubscription()
              setIsPaying(false)
            }}
            disabled={isPaying}
            className="btn btn-primary w-full mt-4"
          >
            {isPaying ? 'Продление...' : '🔄 Продлить на месяц (149 ₽)'}
          </button>

          <p className="text-xs text-gray-400 mt-3">
            Поделитесь кодом с членами семьи. Каждый может ввести его на своём устройстве.
          </p>
        </div>
      </div>
    )
  }

  // Неактивная подписка
  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Оформить подписку */}
      <div className="card p-6 text-center">
        <div className="text-5xl mb-4">🍏</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Семейный холодильник Premium</h2>
        <p className="text-3xl font-bold text-fridge-500 mb-1">149 ₽</p>
        <p className="text-sm text-gray-400 mb-6">в месяц · до 5 устройств</p>

        <ul className="text-left text-sm text-gray-600 space-y-2 mb-6">
          <li>✅ Неограниченные списки покупок</li>
          <li>✅ Синхронизация между устройствами</li>
          <li>✅ AI-помощник с рецептами</li>
          <li>✅ Умные напоминания</li>
          <li>✅ Сканер штрихкодов</li>
          <li>✅ До 5 устройств по одному коду</li>
        </ul>

        <button
          onClick={handlePay}
          disabled={isPaying}
          className="btn btn-primary w-full text-base py-4"
        >
          {isPaying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Оплата...
            </span>
          ) : (
            '💳 Оплатить 149 ₽'
          )}
        </button>

        <p className="text-xs text-gray-400 mt-3">
          Тестовый режим — оплата не спишется
        </p>
      </div>

      {/* Ввести код */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 text-center">
          Уже есть код? Введите его:
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            className="input flex-1 text-center text-lg tracking-widest font-mono uppercase"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button
            onClick={handleJoin}
            disabled={isJoining || joinCode.length < 8}
            className="btn btn-primary px-6"
          >
            {isJoining ? '...' : '→'}
          </button>
        </div>
        {joinMessage && (
          <p className={`text-xs text-center mt-3 ${joinMessage.includes('✅') || joinMessage.includes('привязано') ? 'text-green-600' : 'text-red-500'}`}>
            {joinMessage}
          </p>
        )}
      </div>
    </div>
  )
}
