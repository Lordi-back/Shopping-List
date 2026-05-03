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
  const [editingId, setEditingId] = useState<string | null>(null)

  const filteredItems = items.filter((item) => {
    const itemCategory = item.category || 'products'
    return itemCategory === category
  })

  const activeItems = filteredItems.filter((i) => !i.purchased)
  const purchasedItems = filteredItems.filter((i) => i.purchased)

  const handleAdd = (item: { name: string; quantity: number; unit: string; priority: number; notes: string }) => {
    onAdd(item)
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {/* Статистика */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-400">
          {activeItems.length} в списке · {purchasedItems.length} куплено
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary text-xs py-2 px-4"
        >
          {showForm ? '✕ Закрыть' : '+ Добавить'}
        </button>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <AddItemForm
          category={category}
          onAdd={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Активные товары */}
      {activeItems.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">
            {category === 'products' ? '🛒' : '🧹'}
          </div>
          <p className="text-gray-400 text-sm mb-4">
            {category === 'products'
              ? 'Список продуктов пуст'
              : 'Список бытовых товаров пуст'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-outline text-sm"
          >
            + Добавить первый товар
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <ShoppingItemCard
              key={item.id}
              item={item}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={(id) => setEditingId(id)}
            />
          ))}
        </div>
      )}

      {/* Купленные товары */}
      {purchasedItems.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
            Куплено
          </h4>
          <div className="space-y-2">
            {purchasedItems.map((item) => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={(id) => setEditingId(id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
