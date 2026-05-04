'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreateFamily, checkSubscriptionStatus, joinFamily, leaveFamily, getFamilyDevices } from '@/lib/family'
import { mockPayment } from '@/lib/subscription'

export function SubscriptionPage() {
  const [status, setStatus] = useState<string>('loading')
  const [familyCode, setFamilyCode] = useState<string>('')
  const [daysLeft, setDaysLeft] = useState<number>(0)
  const [joinCode, setJoinCode] = useState('')
  const [joinMessage, setJoinMessage] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [familyId, setFamilyId] = useState<string>('')
  const userId = 'demo-user'

  useEffect(() => { init() }, [])

  const init = async () => {
    const fid = await getOrCreateFamily(userId)
    setFamilyId(fid)
    
    const sub = await checkSubscriptionStatus(userId)
    setStatus(sub.status)
    setDaysLeft(sub.daysLeft || 0)

    const { data: family } = await supabase
      .from('families')
      .select('*')
      .eq('id', fid)
      .single()

    if (family) {
      setFamilyCode(family.invite_code)
      const { data: user } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', userId)
        .single()
      setIsCreator(user?.family_id === fid)
    }

    const devs = await getFamilyDevices(fid)
    setDevices(devs)
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setIsJoining(true)
    setJoinMessage('')
    const result = await joinFamily(userId, joinCode.trim())
    setJoinMessage(result.message)
    if (result.success) {
      setJoinCode('')
      init()
    }
    setIsJoining(false)
  }

  const handleLeave = async () => {
    if (!confirm('Выйти из семьи? Вы потеряете доступ к общему списку.')) return
    await leaveFamily(userId)
    init()
  }

  const handlePay = async () => {
    setIsPaying(true)
    await mockPayment(userId)
    init()
    setIsPaying(false)
  }

  if (status === 'loading') {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="card animate-pulse p-8 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-2xl mx-auto mb-4" />
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Статус подписки */}
      <div className="card p-6 text-center">
        {status === 'admin' && (
          <>
            <div className="text-5xl mb-4">👑</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Админ-доступ</h2>
            <p className="text-sm text-gray-500">Пожизненная подписка</p>
          </>
        )}
        {status === 'active' && (
          <>
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Premium активен!</h2>
          </>
        )}
        {status === 'trial' && (
          <>
            <div className="text-5xl mb-4">🎁</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Пробный период</h2>
            <p className="text-sm text-gray-500 mb-4">{daysLeft} дней осталось</p>
            <button onClick={handlePay} disabled={isPaying} className="btn btn-primary w-full">
              {isPaying ? 'Оплата...' : '💳 149 ₽/мес'}
            </button>
          </>
        )}
        {status === 'expired' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Подписка истекла</h2>
            <button onClick={handlePay} disabled={isPaying} className="btn btn-primary w-full">
              {isPaying ? 'Оплата...' : '💳 149 ₽/мес'}
            </button>
          </>
        )}
      </div>

      {/* Код семьи */}
      {isCreator && familyCode && status !== 'expired' && (
        <div className="card p-6 text-center">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">🔑 Код семьи</h3>
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <code className="text-2xl font-bold text-fridge-500 tracking-widest">{familyCode}</code>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(familyCode); alert('Код скопирован!') }}
            className="btn btn-outline w-full text-sm"
          >
            📋 Скопировать
          </button>
          <p className="text-xs text-gray-400 mt-2">До 5 устройств на один код</p>
        </div>
      )}

      {/* Устройства */}
      {devices.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            📱 Устройства ({devices.length}/5)
          </h3>
          <div className="space-y-2">
            {devices.map((device, i) => (
              <div key={device.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{i === 0 ? '👑' : '📱'}</span>
                  <span className="text-sm text-gray-700">
                    {device.users?.first_name || device.users?.username || 'Устройство'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(device.added_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Кнопка Выйти из семьи */}
      <div className="card p-6 text-center">
        <button onClick={handleLeave} className="btn btn-ghost text-red-500 text-sm w-full">
          🚪 Выйти из семьи
        </button>
        <p className="text-xs text-gray-400 mt-2">Вы потеряете доступ к общему списку</p>
      </div>

      {/* Присоединиться */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 text-center">Присоединиться к семье</h3>
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
          <button onClick={handleJoin} disabled={isJoining || joinCode.length < 8} className="btn btn-primary px-6">
            {isJoining ? '...' : '→'}
          </button>
        </div>
        {joinMessage && (
          <p className={`text-xs text-center mt-3 ${joinMessage.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>
            {joinMessage}
          </p>
        )}
      </div>
    </div>
  )
}
