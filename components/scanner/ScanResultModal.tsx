'use client'

import { useState } from 'react'
import { lookupByBarcode } from '@/lib/barcode-lookup'

type ScanResultModalProps = {
  barcode: string
  onAdd: (item: { name: string; category: 'products' | 'household'; icon: string }) => void
  onClose: () => void
}

export function ScanResultModal({ barcode, onAdd, onClose }: ScanResultModalProps) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{
    name: string
    category: 'products' | 'household'
    icon: string
    imageUrl?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Ищем товар при открытии
  useState(() => {
    lookupByBarcode(barcode).then((res) => {
      setLoading(false)
      if (res) {
        setResult(res)
      } else {
        setError('Товар не найден в базе')
      }
    })
  })

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 animate-slide-up">
          <div className="flex flex-col items-center py-8">
            <div className="w-12 h-12 border-4 border-fridge-200 border-t-fridge-500 rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-500">Ищем товар...</p>
            <p className="text-xs text-gray-400 mt-1 font-mono">{barcode}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 animate-slide-up">
          <div className="text-center py-4">
            <p className="text-4xl mb-3">🔍❌</p>
            <p className="text-sm text-gray-600 mb-1">{error || 'Не удалось найти товар'}</p>
            <p className="text-xs text-gray-400 font-mono mb-4">{barcode}</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-ghost flex-1">
                Отмена
              </button>
              <button
                onClick={() => {
                  const name = prompt('Введите название товара:')
                  if (name?.trim()) {
                    onAdd({
                      name: name.trim(),
                      category: 'products',
                      icon: '📦',
                    })
                  }
                }}
                className="btn btn-primary flex-1"
              >
                ✍️ Вручную
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 animate-slide-up">
        <div className="text-center">
          <p className="text-5xl mb-3">{result.icon}</p>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{result.name}</h3>
          <span
            className={`badge mb-4 ${
              result.category === 'household' ? 'badge-household' : 'badge-products'
            }`}
          >
            {result.category === 'products' ? 'Продукты' : 'Быт'}
          </span>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            Отмена
          </button>
          <button
            onClick={() =>
              onAdd({
                name: result.name,
                category: result.category,
                icon: result.icon,
              })
            }
            className="btn btn-primary flex-1"
          >
            ✅ Добавить в список
          </button>
        </div>
      </div>
    </div>
  )
}
