'use client'

import { useState } from 'react'
import { ShoppingItem } from '@/lib/supabase'
import { ShoppingItemCard } from './ShoppingItemCard'
import { AddItemForm } from './AddItemForm'

type ShoppingListProps = {
  items: ShoppingItem[]
  category: 'products' | 'household'
  onToggle: (id: string, purchased: boolean) => void
  onDelete: (id: string) => void
  onAdd: (item: { name: string; quantity: number; unit: string; priority: number; notes: string }) => void
}

export function ShoppingList({ items, category, onToggle, onDelete, onAdd }: ShoppingListProps) {
  const [showForm, setShowForm] = useState(false)

  const filteredItems = items.filter((item) => {
    const itemCategory = item.category || 'products'
    return itemCategory === category
  })

  const toBuyItems = filteredItems.filter((i) => !i.purchased)
  const atHomeItems = filteredItems.filter((i) => i.purchased)

  const handleAdd = (item: { name: string; quantity: number; unit: string; priority: number; notes: string }) => {
    onAdd(item)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      {showForm && (
        <AddItemForm
          category={category}
          onAdd={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Секция "Купить" */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            🛒 Купить
            {toBuyItems.length > 0 && (
              <span className="text-sm font-normal text-gray-400">({toBuyItems.length})</span>
            )}
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary text-xs py-2 px-4"
          >
            {showForm ? '✕ Закрыть' : '+ Добавить'}
          </button>
        </div>

        {toBuyItems.length === 0 && !showForm ? (
          <div className="text-center py-8 bg-gray-50 rounded-2xl">
            <div className="text-4xl mb-3">{category === 'products' ? '🛒' : '🧹'}</div>
            <p className="text-gray-400 text-sm">Список покупок пуст</p>
          </div>
        ) : (
          <div className="space-y-2">
            {toBuyItems.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* Секция "Дома" */}
      {atHomeItems.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-400 mb-3 flex items-center gap-2">
            🏠 Дома
            <span className="text-sm font-normal">({atHomeItems.length})</span>
          </h3>
          <div className="space-y-2 opacity-60">
            {atHomeItems.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={() => {}}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
