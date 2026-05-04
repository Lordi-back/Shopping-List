'use client'

import { useState, useEffect } from 'react'
import { supabase, ShoppingItem } from '@/lib/supabase'
import { TabBar } from '@/components/ui/TabBar'
import { ShoppingList } from '@/components/shopping/ShoppingList'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { ScanResultModal } from '@/components/scanner/ScanResultModal'
import { useToast } from '@/components/ui/ToastProvider'
import { ReminderBanner } from '@/components/reminders/ReminderBanner'
import { recordPurchase } from '@/lib/prediction-engine'
import { useStore } from '@/lib/store'

const TABS = [
  { id: 'products', label: 'Продукты', icon: '🥑' },
  { id: 'household', label: 'Быт', icon: '🧹' },
]

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('products')
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const { showToast } = useToast()
  const { items, loadItems } = useStore()

  useEffect(() => {
    loadItems().then(() => setLoading(false))
  }, [])

  // Realtime — только для тостов, стейт обновляется через loadItems
  useEffect(() => {
    const channel = supabase
      .channel('shopping-toasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shopping_list' },
        (payload) => {
          const item = payload.new as ShoppingItem
          showToast('success', `🛒 ${item.products?.name || 'Товар'} добавлен в список`)
          loadItems()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shopping_list' },
        (payload) => {
          const item = payload.new as ShoppingItem
          const oldItem = payload.old as ShoppingItem
          if (item.purchased && !oldItem?.purchased) {
            showToast('success', `✅ ${item.products?.name || 'Товар'} куплен!`)
          }
          loadItems()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'shopping_list' },
        (payload) => {
          const item = payload.old as ShoppingItem
          showToast('info', `🗑️ ${item?.products?.name || 'Товар'} удалён из списка`)
          loadItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [showToast, loadItems])

  const handleScan = (barcode: string) => {
    setShowScanner(false)
    setScannedBarcode(barcode)
  }

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
      .maybeSingle()

    if (newProduct) {
        const { error } = await supabase
      .from('shopping_list')
      .insert({
        product_id: productId,
        quantity: newItem.quantity,
        priority: newItem.priority || 1,
        purchased: false,
        category: activeTab,
        notes: newItem.notes || null,
      })

    if (error) {
      showToast('error', `Ошибка: ${error.message}`)
      return
    }

    showToast('success', `${getIconForCategory(activeTab)} ${newItem.name} добавлен`)
    loadItems()
    }

    setScannedBarcode(null)
  }

  const handleToggle = async (id: string, purchased: boolean) => {
    const item = items.find((i) => i.id === id)

    const { error } = await supabase
      .from('shopping_list')
      .update({
        purchased,
        purchased_at: purchased ? new Date().toISOString() : null,
      })
      .eq('id', id)

    if (error) {
      showToast('error', 'Не удалось обновить')
    } else if (purchased && item?.products?.name) {
      recordPurchase('demo-user', item.products.name, item.category)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('shopping_list').delete().eq('id', id)
    if (error) {
      showToast('error', 'Не удалось удалить')
    }
  }

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
      .maybeSingle()

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
        .maybeSingle()

      if (productError || !newProduct) {
        showToast('error', `Ошибка: ${productError?.message || 'неизвестно'}`)
        return
      }
      productId = newProduct.id
    }

    const { error } = await supabase
      .from('shopping_list')
      .insert({
        product_id: productId,
        quantity: newItem.quantity,
        priority: newItem.priority || 1,
        purchased: false,
        category: activeTab,
        notes: newItem.notes || null,
      })

    if (error) {
      showToast('error', `Ошибка: ${error.message}`)
    }
  }

  const counts = {
    products: items.filter((i) => (i.category || 'products') === 'products' && !i.purchased).length,
    household: items.filter((i) => i.category === 'household' && !i.purchased).length,
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🍏 Семейный холодильник</h1>
          <p className="text-sm text-gray-400 mt-1">Умный список покупок</p>
        </div>
        <div className="flex gap-2">
          <a href="/subscription" className="btn btn-ghost text-sm py-2 px-3">🏆</a>
          <button onClick={() => setShowScanner(true)} className="btn btn-outline text-sm py-2 px-4 gap-2">
            <span className="text-lg">📷</span>
            <span className="hidden sm:inline">Сканер</span>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <TabBar
          tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.id as keyof typeof counts] || 0 }))}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <ReminderBanner
        onAddItem={(name) => handleAdd({ name, quantity: 1, unit: 'шт.', priority: 1, notes: '' })}
        onDismiss={() => {}}
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-200 rounded-full" />
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="flex-1"><div className="h-4 bg-gray-200 rounded w-24 mb-1" /><div className="h-3 bg-gray-200 rounded w-16" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ShoppingList items={items} category={activeTab as 'products' | 'household'} onToggle={handleToggle} onDelete={handleDelete} onAdd={handleAdd} />
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {scannedBarcode && <ScanResultModal barcode={scannedBarcode} onAdd={handleScannedAdd} onClose={() => setScannedBarcode(null)} />}
    </div>
  )
}

function getIconForCategory(category: string): string {
  return { products: '🛒', household: '🧹' }[category] || '📦'
}
