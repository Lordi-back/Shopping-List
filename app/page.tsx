'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Refrigerator as Fridge, 
  ShoppingCart, 
  Plus, 
  Check, 
  Trash2,
  Bell,
  Users,
  BarChart3,
  Settings,
  Phone,
  Globe,
  MessageCircle 
} from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'fridge' | 'shopping'>('fridge')
  const [items, setItems] = useState<any[]>([])
  const [shoppingList, setShoppingList] = useState<any[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [familyCode, setFamilyCode] = useState('')

  // Загрузка данных
  useEffect(() => {
    loadData()
    setupRealtime()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    try {
      // Загружаем холодильник
      const { data: fridgeData } = await supabase
        .from('fridge_items')
        .select(`
          *,
          products (*)
        `)
        .order('created_at', { ascending: false })

      // Загружаем список покупок
      const { data: shoppingData } = await supabase
        .from('shopping_list')
        .select(`
          *,
          products (*)
        `)
        .eq('purchased', false)
        .order('priority', { ascending: true })

      setItems(fridgeData || [])
      setShoppingList(shoppingData || [])
    } catch (error) {
      console.error('Ошибка загрузки:', error)
    } finally {
      setLoading(false)
    }
  }

  // Realtime подписка
  const setupRealtime = () => {
    supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fridge_items' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list' },
        () => loadData()
      )
      .subscribe()
  }

  // Добавить продукт
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    try {
      // 1. Создаем продукт
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([{ 
          name: newItem.trim(),
          category: 'other',
          unit: 'шт'
        }])
        .select()
        .single()

      if (productError) throw productError

      // 2. Добавляем в холодильник
      const { error: fridgeError } = await supabase
        .from('fridge_items')
        .insert([{
          product_id: product.id,
          quantity: 1
        }])

      if (fridgeError) throw fridgeError

      // 3. Обновляем данные
      await loadData()
      setNewItem('')
      
      alert(`✅ Добавлено: ${newItem.trim()}`)
    } catch (error) {
      console.error('Ошибка добавления:', error)
      alert('❌ Ошибка при добавлении. Проверьте консоль.')
    }
  }

  // Добавить в список покупок
  const addToShoppingList = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .insert([{
          product_id: productId,
          quantity: 1,
          priority: 1
        }])

      if (error) throw error
      
      await loadData()
      alert('✅ Добавлено в список покупок')
    } catch (error) {
      console.error('Ошибка:', error)
      alert('❌ Ошибка')
    }
  }

  // Удалить из холодильника
  const removeFromFridge = async (id: string) => {
    try {
      const { error } = await supabase
        .from('fridge_items')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      await loadData()
      alert('✅ Удалено')
    } catch (error) {
      console.error('Ошибка:', error)
      alert('❌ Ошибка')
    }
  }

  // Отметить купленным
  const markAsPurchased = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ purchased: true })
        .eq('id', id)

      if (error) throw error
      
      await loadData()
    } catch (error) {
      console.error('Ошибка:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🍏 Семейный холодильник
        </h1>
        <p className="text-gray-600">Синхронизированный список продуктов</p>
      </header>

      <main className="max-w-4xl mx-auto">
        {/* Форма добавления */}
        <form onSubmit={addItem} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Что добавить? (молоко, хлеб...)"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-600"
            >
              <Plus size={20} />
              Добавить
            </button>
          </div>
        </form>

        {/* Табы */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('fridge')}
            className={`px-4 py-3 font-medium ${
              activeTab === 'fridge'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500'
            }`}
          >
            📦 В холодильнике ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('shopping')}
            className={`px-4 py-3 font-medium ${
              activeTab === 'shopping'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500'
            }`}
          >
            🛒 Купить ({shoppingList.length})
          </button>
        </div>

        {/* Контент */}
        {loading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : activeTab === 'fridge' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-lg border">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold">{item.products?.name || 'Без названия'}</h3>
                    <p>Количество: {item.quantity}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addToShoppingList(item.product_id)}
                      className="text-green-600"
                      title="В покупки"
                    >
                      <ShoppingCart size={18} />
                    </button>
                    <button
                      onClick={() => removeFromFridge(item.id)}
                      className="text-red-600"
                      title="Удалить"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {shoppingList.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-lg border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => markAsPurchased(item.id)}
                    className="w-6 h-6 border rounded"
                  >
                    {item.purchased && <Check size={14} />}
                  </button>
                  <div>
                    <h3>{item.products?.name || 'Без названия'}</h3>
                    <p>Количество: {item.quantity}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
