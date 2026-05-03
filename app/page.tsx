'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, ShoppingItem } from '@/lib/supabase'
import { TabBar } from '@/components/ui/TabBar'
import { ShoppingList } from '@/components/shopping/ShoppingList'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { ScanResultModal } from '@/components/scanner/ScanResultModal'
import { useToast } from '@/components/ui/ToastProvider'

const TABS = [
  { id: 'products', label: 'Продукты', icon: '🥑' },
  { id: 'household', label: 'Быт', icon: '🧹' },
]

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('products')
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const { showToast } = useToast()

  // Загрузка списка
  const loadItems = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*, products(*)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки:', error)
    } else {
      setItems((data as ShoppingItem[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Обработчик сканирования
  const handleScan = (barcode: string) => {
    setShowScanner(false)
    setScannedBarcode(barcode)
  }

  // Добавление отсканированного товара
  const handleScannedAdd = async (item: {
    name: string
    category: 'products' | 'household'
    icon: string
  }) => {
    const { data: newProduct } = await supabase
      .from('products')
      .insert({
        name: item.name,
        category: item.category,
        icon: item.icon,
        barcode: scannedBarcode,
      })
      .select()
      .single()

    if (newProduct) {
      const { data: addedItem } = await supabase
        .from('shopping_list')
        .insert({
          product_id: newProduct.id,
          quantity: 1,
          priority: 0,
          purchased: false,
          category: item.category,
        })
        .select('*, products(*)')
        .single()

      if (addedItem) {
        setItems((prev) => [addedItem as ShoppingItem, ...prev])
        showToast('success', `${item.icon} ${item.name} добавлен в ${item.category === 'products' ? 'Продукты' : 'Быт'}`)
      }
    }

    setScannedBarcode(null)
  }

  // Переключение "куплено"
  const handleToggle = async (id: string, purchased: boolean) => {
    const item = items.find((i) => i.id === id)
    const purchasedAt = purchased ? new Date().toISOString() : undefined

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, purchased, purchased_at: purchasedAt } : item
      )
    )

    const { error } = await supabase
      .from('shopping_list')
      .update({
        purchased,
        purchased_at: purchased ? new Date().toISOString() : null,
      })
      .eq('id', id)

    if (error) {
      console.error('Ошибка обновления:', error)
      loadItems()
    } else if (purchased && item?.products?.name) {
      showToast('success', `${item.products.icon || '✅'} ${item.products.name} куплен!`)
    }
  }

  // Удаление товара
  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((item) => item.id !== id))

    const { error } = await supabase.from('shopping_list').delete().eq('id', id)

    if (error) {
      console.error('Ошибка удаления:', error)
      loadItems()
    } else if (item?.products?.name) {
      showToast('info', `${item.products.name} удалён из списка`)
    }
  }

  // Добавление товара вручную
  const handleAdd = async (newItem: {
    name: string
    quantity: number
    unit: string
    priority: number
    notes: string
  }) => {
    const { data: existingProduct } = await supabase
      .from('products')
      .select('*')
      .ilike('name', newItem.name)
      .single()

    let productId: string

    if (existingProduct) {
      productId = existingProduct.id
    } else {
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: newItem.name,
          category: activeTab,
          unit: newItem.unit,
          icon: getIconForCategory(activeTab),
        })
        .select()
        .single()

      if (productError || !newProduct) {
        console.error('Ошибка создания продукта:', productError)
        showToast('error', 'Не удалось добавить товар')
        return
      }
      productId = newProduct.id
    }

    const { data: addedItem, error } = await supabase
      .from('shopping_list')
      .insert({
        product_id: productId,
        quantity: newItem.quantity,
        priority: newItem.priority,
        purchased: false,
        category: activeTab,
        notes: newItem.notes || null,
      })
      .select('*, products(*)')
      .single()

    if (error) {
      console.error('Ошибка добавления:', error)
      showToast('error', 'Не удалось добавить товар')
      return
    }

    if (addedItem) {
      setItems((prev) => [addedItem as ShoppingItem, ...prev])
      showToast('success', `${getIconForCategory(activeTab)} ${newItem.name} добавлен в ${activeTab === 'products' ? 'Продукты' : 'Быт'}`)
    }
  }

  const counts = {
    products: items.filter((i) => (i.category || 'products') === 'products' && !i.purchased).length,
    household: items.filter((i) => i.category === 'household' && !i.purchased).length,
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      {/* Заголовок */}
     <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🍏 Семейный холодильник</h1>
          <p className="text-sm text-gray-400 mt-1">Умный список покупок</p>
        </div>
        <div className="flex gap-2">
          {/* Кнопка подписки */}
          <a href="/subscription" className="btn btn-ghost text-sm py-2 px-3">
            🏆
          </a>
          {/* Кнопка сканера */}
          <button
            onClick={() => setShowScanner(true)}
            className="btn btn-outline text-sm py-2 px-4 gap-2"
          >
            <span className="text-lg">📷</span>
            <span className="hidden sm:inline">Сканер</span>
          </button>
        </div>
      </div>

      {/* Вкладки */}
      <div className="mb-4">
        <TabBar
          tabs={TABS.map((tab) => ({
            ...tab,
            count: counts[tab.id as keyof typeof counts] || 0,
          }))}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Список */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-200 rounded-full" />
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ShoppingList
          items={items}
          category={activeTab as 'products' | 'household'}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={handleAdd}
        />
      )}

      {/* Сканер (модальное окно) */}
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* Результат сканирования */}
      {scannedBarcode && (
        <ScanResultModal
          barcode={scannedBarcode}
          onAdd={handleScannedAdd}
          onClose={() => setScannedBarcode(null)}
        />
      )}
    </div>
  )
}

function getIconForCategory(category: string): string {
  const icons: Record<string, string> = {
    products: '🛒',
    household: '🧹',
  }
  return icons[category] || '📦'
}
