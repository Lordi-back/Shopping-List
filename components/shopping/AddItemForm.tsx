'use client'

import { useState } from 'react'

type AddItemFormProps = {
  category: 'products' | 'household'
  onAdd: (item: { name: string; quantity: number; unit: string; priority: number; notes: string }) => void
  onClose: () => void
}

const QUICK_ITEMS: Record<string, { name: string; icon: string; unit: string }[]> = {
  products: [
    { name: 'Молоко', icon: '🥛', unit: 'л' },
    { name: 'Хлеб', icon: '🍞', unit: 'шт.' },
    { name: 'Яйца', icon: '🥚', unit: 'шт.' },
    { name: 'Сыр', icon: '🧀', unit: 'г' },
    { name: 'Масло', icon: '🧈', unit: 'г' },
    { name: 'Курица', icon: '🍗', unit: 'кг' },
  ],
  household: [
    { name: 'Салфетки', icon: '🧻', unit: 'уп.' },
    { name: 'Губки', icon: '🧽', unit: 'шт.' },
    { name: 'Порошок', icon: '🧴', unit: 'кг' },
    { name: 'Мыло', icon: '🧼', unit: 'шт.' },
    { name: 'Пакеты', icon: '🛍️', unit: 'уп.' },
    { name: 'Освежитель', icon: '🌿', unit: 'шт.' },
  ],
}

export function AddItemForm({ category, onAdd, onClose }: AddItemFormProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [priority, setPriority] = useState(0)
  const [notes, setNotes] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const quickItems = QUICK_ITEMS[category] || []

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    onAdd({
      name: trimmedName,
      quantity,
      unit: 'шт.',
      priority,
      notes: notes.trim(),
    })
    setName('')
    setQuantity(1)
    setPriority(0)
    setNotes('')
    setShowCustom(false)
  }

  const handleQuickAdd = (itemName: string, unit: string) => {
    onAdd({
      name: itemName,
      quantity: 1,
      unit,
      priority: 0,
      notes: '',
    })
  }

  return (
    <div className="card animate-bounce-in">
      {/* Быстрые товары */}
      {!showCustom && (
        <>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Часто добавляют
          </h4>
          <div className="flex flex-wrap gap-2 mb-4">
            {quickItems.map((item) => (
              <button
                key={item.name}
                onClick={() => handleQuickAdd(item.name, item.unit)}
                className="btn btn-outline text-xs py-2 px-3"
              >
                {item.icon} {item.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCustom(true)}
            className="btn btn-ghost text-xs w-full"
          >
            ✍️ Добавить свой товар
          </button>
        </>
      )}

      {/* Свой товар */}
      {showCustom && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowCustom(false)}
              className="btn btn-ghost p-2"
            >
              ←
            </button>
            <h4 className="text-sm font-medium">Новый товар</h4>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={category === 'products' ? 'Название продукта' : 'Название товара'}
            className="input mb-2"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />

          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Количество</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-sm"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-sm"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Приоритет</label>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`w-8 h-8 rounded-xl text-xs transition-all ${
                      priority >= p && p > 0
                        ? 'bg-warm-100 text-warm-600 font-medium'
                        : 'bg-gray-100 text-gray-400'
                    } ${p === 0 ? 'text-gray-300' : ''}`}
                  >
                    {p === 0 ? '−' : '★'.repeat(p)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Заметка (необязательно)"
            className="input mb-3 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />

          <button onClick={handleSubmit} className="btn btn-primary w-full">
            ✅ Добавить в список
          </button>
        </>
      )}
    </div>
  )
}
