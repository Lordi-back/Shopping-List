'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Refrigerator as Fridge, 
  ShoppingCart, 
  Plus, 
  Check, 
  Trash2,
  Copy,
  CheckCircle,
  MessageCircle,
  Key,
  User,
  X
} from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'fridge' | 'shopping'>('fridge')
  const [items, setItems] = useState<any[]>([])
  const [shoppingList, setShoppingList] = useState<any[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Состояния для синхронизации
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncCode, setSyncCode] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isLinked, setIsLinked] = useState(false)
  const [telegramUsername, setTelegramUsername] = useState('')
  const [linkDate, setLinkDate] = useState('')
  const [userId] = useState(() => {
    // Генерируем постоянный ID пользователя
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('user_id')
      if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 15)
        localStorage.setItem('user_id', id)
      }
      return id
    }
    return 'user_anonymous'
  })

  useEffect(() => {
    loadData()
    setupRealtime()
    checkSyncStatus()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    try {
      const { data: fridgeData } = await supabase
        .from('fridge_items')
        .select(`
          *,
          products (*)
        `)
        .order('created_at', { ascending: false })

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

  // Проверяем статус синхронизации
  const checkSyncStatus = async () => {
    try {
      const response = await fetch(`/api/user/sync?userId=${userId}`)
      const data = await response.json()
      
      if (data.exists) {
        setSyncCode(data.code)
        setIsLinked(data.isLinked)
        setTelegramUsername(data.telegramUsername || '')
        if (data.created) {
          setLinkDate(new Date(data.created).toLocaleDateString('ru-RU'))
        }
      }
    } catch (error) {
      console.log('Нет данных синхронизации')
    }
  }

  // Генерация/получение кода
  const handleSyncClick = async () => {
    setSyncLoading(true)
    
    try {
      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()
      
      if (data.success) {
        setSyncCode(data.code)
        setIsLinked(data.isLinked)
        setTelegramUsername(data.telegramUsername || '')
        if (data.linkedAt) {
          setLinkDate(new Date(data.linkedAt).toLocaleDateString('ru-RU'))
        }
        setSyncModalOpen(true)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSyncLoading(false)
    }
  }

  // Копирование кода
  const copyToClipboard = async () => {
    if (!syncCode) return
    
    try {
      await navigator.clipboard.writeText(syncCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

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

  // Компонент TelegramSyncPanel
  const TelegramSyncPanel = () => (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <MessageCircle className="text-blue-600 mr-2" size={22} />
            <h3 className="text-lg font-semibold text-gray-800">Telegram Синхронизация</h3>
          </div>
          
          {isLinked ? (
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full">
              <CheckCircle size={14} className="mr-1" />
              <span className="text-sm font-medium">Привязан</span>
            </div>
          ) : (
            <div className="flex items-center bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
              <Key size={14} className="mr-1" />
              <span className="text-sm font-medium">Не привязан</span>
            </div>
          )}
        </div>
        
        {isLinked ? (
          <div className="space-y-3">
            <p className="text-gray-700">
              ✅ Ваш аккаунт привязан к Telegram
              {telegramUsername && (
                <span className="font-medium"> (@{telegramUsername})</span>
              )}
              {linkDate && (
                <span className="text-sm text-gray-500 ml-2">с {linkDate}</span>
              )}
            </p>
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-gray-100 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Ваш постоянный код:</div>
                <div className="font-mono text-lg font-bold text-blue-700">{syncCode}</div>
              </div>
              <button
                onClick={copyToClipboard}
                className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200"
                title="Скопировать код"
              >
                {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Этот код можно использовать повторно для привязки других устройств или аккаунтов.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-700">
              Привяжите Telegram-бота для управления списками из мессенджера и получения уведомлений.
            </p>
            <button
              onClick={handleSyncClick}
              disabled={syncLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-medium flex items-center justify-center hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
            >
              {syncLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Загрузка...
                </>
              ) : (
                <>
                  <Key className="mr-2" size={20} />
                  Получить код для Telegram
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // Модальное окно с кодом
  const SyncCodeModal = () => {
    if (!syncModalOpen || !syncCode) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
          {/* Шапка */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold flex items-center">
                  <Key className="mr-2" size={24} />
                  Ваш код синхронизации
                </h3>
                <p className="text-blue-100 mt-1">Постоянный код для привязки Telegram</p>
              </div>
              <button
                onClick={() => setSyncModalOpen(false)}
                className="text-white hover:text-blue-200"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          {/* Тело */}
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-blue-50 rounded-xl mb-4">
                <MessageCircle className="text-blue-500 mx-auto" size={48} />
              </div>
              
              <p className="text-gray-700 mb-6">
                Отправьте этот код в Telegram-бота командой:
              </p>
              
              <div className="bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-lg mb-4">
                <span className="text-gray-400">/code</span> <span className="text-green-300">{syncCode}</span>
              </div>
              
              {/* Код крупно */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-xl mb-6 border-2 border-blue-200">
                <div className="text-5xl font-bold font-mono tracking-wider text-blue-700">
                  {syncCode.match(/.{1,4}/g)?.join(' ')}
                </div>
                <div className="text-sm text-blue-600 mt-3 font-medium">
                  ⭐ Постоянный код · Не истекает
                </div>
              </div>
              
              <button
                onClick={copyToClipboard}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center hover:from-green-600 hover:to-emerald-700 transition-all mb-4"
              >
                {copied ? (
                  <>
                    <CheckCircle className="mr-2" size={24} />
                    Код скопирован!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2" size={24} />
                    Скопировать код
                  </>
                )}
              </button>
              
              <div className="text-sm text-gray-600 space-y-2">
                <p className="flex items-center">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-2">1</span>
                  Скопируйте код выше
                </p>
                <p className="flex items-center">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-2">2</span>
                  Откройте Telegram и найдите бота
                </p>
                <p className="flex items-center">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-2">3</span>
                  Отправьте команду: <code className="ml-2 bg-gray-100 px-2 py-1 rounded">/code {syncCode}</code>
                </p>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex items-center text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span>Этот код будет работать всегда для вашего аккаунта</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Остальные функции остаются без изменений
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    try {
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

      const { error: fridgeError } = await supabase
        .from('fridge_items')
        .insert([{
          product_id: product.id,
          quantity: 1
        }])

      if (fridgeError) throw fridgeError

      await loadData()
      setNewItem('')
      
      alert(`✅ Добавлено: ${newItem.trim()}`)
    } catch (error) {
      console.error('Ошибка добавления:', error)
      alert('❌ Ошибка при добавлении')
    }
  }

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-3">
          🍏 Семейный холодильник
        </h1>
        <p className="text-gray-600 text-lg">Умный список продуктов с Telegram-синхронизацией</p>
      </header>

      <main className="max-w-4xl mx-auto">
        {/* Добавляем панель синхронизации */}
        <TelegramSyncPanel />
        
        {/* Форма добавления */}
        <form onSubmit={addItem} className="mb-6 bg-white p-5 rounded-2xl shadow-lg border border-gray-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Что добавить в холодильник? (молоко, хлеб, яйца...)"
              className="flex-1 border-2 border-gray-300 rounded-xl px-5 py-4 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl flex items-center gap-3 hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
            >
              <Plus size={24} />
              <span className="font-semibold">Добавить</span>
            </button>
          </div>
        </form>

        {/* Табы */}
        <div className="flex bg-white rounded-xl p-1 mb-6 shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('fridge')}
            className={`flex-1 px-6 py-4 font-semibold rounded-lg text-center transition-all ${
              activeTab === 'fridge'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            <div className="flex items-center justify-center">
              <Fridge size={20} className="mr-2" />
              В холодильнике ({items.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('shopping')}
            className={`flex-1 px-6 py-4 font-semibold rounded-lg text-center transition-all ${
              activeTab === 'shopping'
                ? 'bg-green-500 text-white shadow-md'
                : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            <div className="flex items-center justify-center">
              <ShoppingCart size={20} className="mr-2" />
              Купить ({shoppingList.length})
            </div>
          </button>
        </div>

        {/* Контент */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600">Загружаем данные...</p>
          </div>
        ) : activeTab === 'fridge' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{item.products?.name || 'Без названия'}</h3>
                    <div className="flex items-center mt-2">
                      <span className="text-gray-600">Количество:</span>
                      <span className="ml-2 font-semibold">{item.quantity} шт</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addToShoppingList(item.product_id)}
                      className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      title="В список покупок"
                    >
                      <ShoppingCart size={20} />
                    </button>
                    <button
                      onClick={() => removeFromFridge(item.id)}
                      className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      title="Удалить"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {shoppingList.map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => markAsPurchased(item.id)}
                      className={`w-8 h-8 border-2 rounded-lg flex items-center justify-center ${
                        item.purchased 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {item.purchased && <Check size={18} />}
                    </button>
                    <div>
                      <h3 className="font-semibold text-gray-800">{item.products?.name || 'Без названия'}</h3>
                      <div className="flex items-center text-gray-600">
                        <span>Количество:</span>
                        <span className="ml-2 font-medium">{item.quantity} шт</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Модальное окно */}
        <SyncCodeModal />
      </main>
    </div>
  )
}
