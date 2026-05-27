'use client'

import { ShoppingItem } from '@/lib/supabase'

type ShoppingItemCardProps = {
  item: ShoppingItem
  onToggle: (id: string, purchased: boolean) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}

export function ShoppingItemCard({ item, onToggle, onDelete, onEdit }: ShoppingItemCardProps) {
  return (
    <div
      className={`
        card flex items-center gap-3 animate-slide-up cursor-pointer
        ${item.purchased ? 'opacity-50' : ''}
      `}
      onClick={() => onEdit(item.id)}
    >
      {/* Чекбокс */}
          
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle(item.id, !item.purchased)
        }}
        className={`
          w-6 h-6 rounded-full border-2 flex items-center justify-center
          flex-shrink-0 transition-all duration-200
          ${item.purchased
            ? 'bg-fridge-500 border-fridge-500'
            : 'border-gray-300 hover:border-fridge-400'
          }
        `}
      >
        {item.purchased && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Иконка продукта */}
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
        {item.products?.icon || (item.category === 'household' ? '🧹' : '🛒')}
      </div>

      {/* Информация */}
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-medium truncate ${item.purchased ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {item.products?.name || 'Товар'}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">
            {item.quantity} {item.products?.unit || 'шт.'}
          </span>
          {item.notes && (
            <span className="text-xs text-gray-300 truncate">· {item.notes}</span>
          )}
        </div>
      </div>

      {/* Приоритет */}
      {item.priority > 0 && (
        <span className={`
          text-xs px-2 py-1 rounded-full font-medium flex-shrink-0
          ${item.priority >= 3 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}
        `}>
          {item.priority >= 3 ? 'Срочно' : 'Важно'}
        </span>
      )}

      {/* Кнопка удаления */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(item.id)
        }}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  )
}
