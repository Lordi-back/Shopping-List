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
import { getOrCreateFamily, checkSubscriptionStatus, getDeviceId } from '@/lib/family'


const TABS = [
  { id: 'products', label: 'Продукты', icon: '🥑' },
  { id: 'household', label: 'Быт', icon: '🧹' },
]

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('products')
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [subStatus, setSubStatus] = useState<string>('loading')
  const [daysLeft, setDaysLeft] = useState<number>(0)
  const { showToast } = useToast()
  const { items, loadItems, addItem, toggleItem, deleteItem } = useStore()

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    setLoading(true)
    const userId = getDeviceId()
    const familyId = await getOrCreateFamily(userId)
    localStorage.setItem('family_id', familyId)
    await loadItems(familyId)
    const status = await checkSubscriptionStatus(userId)
    setSubStatus(status.status)
    setDaysLeft(status.daysLeft || 0)
    setLoading(false)
  }

  useEffect(() => {
    const channel = supabase
      .channel('shopping-toasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shopping_list' },
        (payload) => {
          const item = payload.new as ShoppingItem
          showToast('success', `🛒 ${item.products?.name || 'Товар'} добавлен`)
          loadItems(localStorage.getItem('family_id') || '')
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shopping_list' },
        (payload) => {
          const item = payload.new as ShoppingItem
          if (item.purchased) showToast('success', `✅ ${item.products?.name || 'Товар'} куплен!`)
          loadItems(localStorage.getItem('family_id') || '')
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'shopping_list' },
        (payload) => {
          showToast('info', `🗑️ Товар удалён`)
          loadItems(localStorage.getItem('family_id') || '')
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

  // 🧾 Обработчик сканирования чека
  const handleReceiptScan = async (items: { name: string; price: number }[]) => {
    const familyId = localStorage.getItem('family_id') || ''
    let addedCount = 0

    for (const item of items) {
      try {
        await addItem(item.name, activeTab as 'products' | 'household', 1, familyId)
        addedCount++
      } catch (err) {
        console.error('Ошибка добавления из чека:', item.name, err)
      }
    }

    if (addedCount > 0) {
      showToast('success', `✅ Добавлено ${addedCount} товаров из чека`)
      await loadItems(familyId)
    } else {
      showToast('error', 'Не удалось добавить товары из чека')
    }
  }

  const handleScannedAdd = async (item: { name: string; category: 'products' | 'household'; icon: string }) => {
    const familyId = localStorage.getItem('family_id')
    const { data: newProduct } = await supabase
      .from('products')
      .insert({ name: item.name, category: item.category, icon: item.icon, barcode: scannedBarcode })
      .select()
      .maybeSingle()

    if (newProduct) {
      await supabase.from('shopping_list').insert({
        product_id: newProduct.id,
        quantity: 1,
        priority: 1,
        purchased: false,
        category: item.category,
        family_id: familyId,
      })
    }
    setScannedBarcode(null)
  }

  const handleToggle = async (id: string, purchased: boolean) => {
    const item = items.find((i) => i.id === id)
    await toggleItem(id, purchased)
    if (purchased && item?.products?.name) {
      recordPurchase(getDeviceId(), item.products.name, item.category)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteItem(id)
  }

  const handleAdd = async (newItem: { name: string; quantity: number; unit: string; priority: number; notes: string }) => {
    const familyId = localStorage.getItem('family_id') || ''
    await addItem(newItem.name, activeTab as 'products' | 'household', newItem.quantity, familyId)
    showToast('success', `✅ ${newItem.name} добавлен`)
    await loadItems(familyId)
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

      {subStatus === 'trial' && (
        <div className="card bg-blue-50 border border-blue-200 mb-4 p-4 animate-slide-up">
          <p className="text-sm font-semibold text-blue-800">🎁 Пробный период: {daysLeft} дн. осталось</p>
          <p className="text-xs text-blue-600">Потом 149₽/мес для всей семьи</p>
        </div>
      )}

      {subStatus === 'expired' && (
        <div className="card bg-warm-50 border border-warm-200 mb-4 p-4 animate-slide-up">
          <p className="text-sm font-semibold text-warm-800">⚠️ Пробный период закончился</p>
          <p className="text-xs text-warm-600 mb-2">Оформите подписку за 149₽/мес</p>
          <a href="/subscription" className="btn btn-primary text-sm">Оформить подписку</a>
        </div>
      )}

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

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onReceiptScan={handleReceiptScan}
          onClose={() => setShowScanner(false)}
        />
      )}
      {scannedBarcode && <ScanResultModal barcode={scannedBarcode} onAdd={handleScannedAdd} onClose={() => setScannedBarcode(null)} />}
    </div>
  )
}
