'use client'

import { useState, useEffect } from 'react'
import { supabase, type FridgeItem } from '@/lib/supabase'
import { Plus, Trash2, ShoppingCart, Check, Users, Bell } from 'lucide-react'

export default function Home() {
  const [items, setItems] = useState<FridgeItem[]>([])
  const [shoppingList, setShoppingList] = useState<any[]>([])
  const [newItem, setNewItem] = useState('')
  const [familyCode, setFamilyCode] = useState('')
  const [activeTab, setActiveTab] = useState<'fridge' | 'shopping'>('fridge')

  // Загрузка данных при монтировании
  useEffect(() => {
    loadData()
    setupRealtime()
  }, [])

  const loadData = async () => {
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

    setItems(fridgeData || [])
    setShoppingList(shoppingData || [])
  }

  const setupRealtime = () => {
    // Подписываемся на изменения
    supabase
      .channel('public:fridge_items')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'fridge_items' },
        () => loadData()
      )
      .subscribe()
  }

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    try {
      // Сначала находим или создаем продукт
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .ilike('name', newItem.trim())
        .single()

      let productId

      if (existingProduct) {
        productId = existingProduct.id
      } else {
        const { data: newProduct } = await supabase
          .from('products')
          .insert([{ 
            name: newItem.trim(),
            category: 'other',
            unit: 'шт'
          }])
          .select()
          .single()
        
        productId = newProduct?.id
      }

      // Добавляем в холодильник
      if (productId) {
        await supabase
          .from('fridge_items')
          .insert([{
            product_id: productId,
            quantity: 1
          }])
        
        setNewItem('')
      }
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  const removeItem = async (id: string) => {
    await supabase
      .from('fridge_items')
      .delete()
      .eq('id', id)
  }

  const addToShoppingList = async (productId: string) => {
    await supabase
      .from('shopping_list')
      .insert([{
        product_id: productId,
        quantity: 1,
        priority: 1
      }])
  }

  const markAsPurchased = async (id: string) => {
    await supabase
      .from('shopping_list')
      .update({ purchased: true })
      .eq('id', id)
  }

  const createFamily = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data } = await supabase
      .from('families')
      .insert([{ name: 'Наша семья', invite_code: code }])
      .select()
      .single()
    
    if (data) {
      setFamilyCode(code)
      localStorage.setItem('family_code', code)
      alert(`Код для семьи: ${code}\nПоделитесь этим кодом!`)
    }
  }

  const joinFamily = async () => {
    if (!familyCode.trim()) return
    
    const { data } = await supabase
      .from('families')
      .select('id')
      .eq('invite_code', familyCode.trim().toUpperCase())
      .single()
    
    if (data) {
      localStorage.setItem('family_code', familyCode)
      alert('Вы присоединились к семье!')
      loadData()
    } else {
      alert('Неверный код')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🍏 Семейный холодильник
        </h1>
        <p className="text-gray-600">
          Синхронизированный список продуктов для всей семьи
        </p>
        
        {/* Приглашение семьи */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={createFamily}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            <Users size={20} />
            Создать семью
          </button>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Введите код семьи"
              value={familyCode}
              onChange={(e) => setFamilyCode(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
            />
            <button
              onClick={joinFamily}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            >
              Присоединиться
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {/* Табы */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('fridge')}
            className={`flex items-center gap-2 px-4 py-3 font-medium ${
              activeTab === 'fridge'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📦 В холодильнике ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('shopping')}
            className={`flex items-center gap-2 px-4 py-3 font-medium ${
              activeTab === 'shopping'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🛒 Купить ({shoppingList.length})
          </button>
        </div>

        {/* Форма добавления */}
        <form onSubmit={addItem} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Что добавить в холодильник?"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-600"
            >
              <Plus size={24} />
              Добавить
            </button>
          </div>
        </form>

        {/* Контент */}
        {activeTab === 'fridge' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow p-4 border border-gray-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {item.products?.name}
                    </h3>
                    <p className="text-gray-600">
                      Количество: {item.quantity} {item.products?.unit || 'шт'}
                    </p>
                    {item.expiry_date && (
                      <p className="text-sm text-gray-500 mt-1">
                        📅 {new Date(item.expiry_date).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => addToShoppingList(item.product_id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Добавить в покупки"
                    >
                      <ShoppingCart size={18} />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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
              <div
                key={item.id}
                className="bg-white rounded-xl shadow p-4 border border-gray-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => markAsPurchased(item.id)}
                    className="w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center hover:border-green-500"
                  >
                    {item.purchased && <Check size={14} className="text-green-500" />}
                  </button>
                  <div>
                    <h3 className="font-semibold">{item.products?.name}</h3>
                    <p className="text-gray-600">
                      {item.quantity} {item.products?.unit || 'шт'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Плавающая кнопка */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}
