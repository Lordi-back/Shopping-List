'use client'

import { useState, useEffect } from 'react'
import { 
  Fridge, ShoppingCart, Plus, Check, Trash2, 
  Bell, Users, BarChart3, Settings,
  Phone, Globe, MessageCircle
} from 'lucide-react'
import { supabase, type FridgeItem, type ShoppingItem } from '@/lib/supabase'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'fridge' | 'shopping'>('fridge')
  const [fridgeItems, setFridgeItems] = useState<FridgeItem[]>([])
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [newProduct, setNewProduct] = useState('')
  const [loading, setLoading] = useState(true)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  // Загрузка данных
  useEffect(() => {
    loadData()
    setupRealtime()
    checkPWAInstallable()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // Загружаем холодильник
    const { data: fridgeData } = await supabase
      .from('fridge_items')
      .select(`
        *,
        products (*)
      `)
      .order('created_at', { ascending: false })

    // Загружаем список покупок (только некупленное)
    const { data: shoppingData } = await supabase
      .from('shopping_list')
      .select(`
        *,
        products (*)
      `)
      .eq('purchased', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    setFridgeItems(fridgeData || [])
    setShoppingItems(shoppingData || [])
    setLoading(false)
  }

  // Realtime подписка
  const setupRealtime = () => {
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Добавить продукт в холодильник
  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProduct.trim()) return

    try {
      // Ищем или создаем продукт
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .ilike('name', newProduct.trim())
        .single()

      let productId

      if (existingProduct) {
        productId = existingProduct.id
      } else {
        const { data: newProductData } = await supabase
          .from('products')
          .insert([{ 
            name: newProduct.trim(),
            category: 'other',
            unit: 'шт'
          }])
          .select()
          .single()
        
        productId = newProductData?.id
      }

      // Добавляем в холодильник
      if (productId) {
        await supabase
          .from('fridge_items')
          .insert([{
            product_id: productId,
            quantity: 1
          }])
        
        setNewProduct('')
      }
    } catch (error) {
      console.error('Error adding product:', error)
    }
  }

  // Перенести в список покупок
  const moveToShopping = async (productId: string) => {
    await supabase
      .from('shopping_list')
      .insert([{
        product_id: productId,
        quantity: 1,
        priority: 1
      }])
  }

  // Удалить из холодильника
  const removeFromFridge = async (id: string) => {
    await supabase
      .from('fridge_items')
      .delete()
      .eq('id', id)
  }

  // Отметить как купленное
  const markAsPurchased = async (id: string) => {
    await supabase
      .from('shopping_list')
      .update({ purchased: true })
      .eq('id', id)
  }

  // Удалить из списка покупок
  const removeFromShopping = async (id: string) => {
    await supabase
      .from('shopping_list')
      .delete()
      .eq('id', id)
  }

  // PWA установка
  const checkPWAInstallable = () => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      
      if ((isIOS || isAndroid) && !isStandalone) {
        setShowInstallPrompt(true)
      }
    }
  }

  const installPWA = () => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      if (window.deferredPrompt) {
        // @ts-ignore
        window.deferredPrompt.prompt()
        // @ts-ignore
        window.deferredPrompt.userChoice.then(() => {
          setShowInstallPrompt(false)
        })
      }
    }
  }

  // Создать ссылку для семьи
  const generateFamilyLink = () => {
    const link = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(link)
    alert('Ссылка скопирована! Отправьте её семье.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Шапка */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Fridge className="text-blue-600" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Семейный холодильник</h1>
                <p className="text-sm text-gray-600">Учет продуктов для всей семьи</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={generateFamilyLink}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Пригласить семью"
              >
                <Users size={20} />
              </button>
              <button
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Настройки"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {/* Быстрые действия */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => document.getElementById('add-product-modal')?.showModal()}
            className="bg-blue-500 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
          >
            <Plus size={24} />
            <span className="text-sm font-medium">Добавить</span>
          </button>
          
          <button
            onClick={() => setActiveTab('shopping')}
            className="bg-green-500 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-green-600 transition-colors"
          >
            <ShoppingCart size={24} />
            <span className="text-sm font-medium">Купить ({shoppingItems.length})</span>
          </button>
          
          <button
            className="bg-purple-500 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
            onClick={() => window.open('https://t.me/YourBotName', '_blank')}
          >
            <MessageCircle size={24} />
            <span className="text-sm font-medium">Telegram бот</span>
          </button>
          
          <button
            className="bg-orange-500 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
          >
            <BarChart3 size={24} />
            <span className="text-sm font-medium">Статистика</span>
          </button>
        </div>

        {/* Табы */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('fridge')}
            className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap ${
              activeTab === 'fridge'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Fridge size={20} />
            В холодильнике
            <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full ml-1">
              {fridgeItems.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('shopping')}
            className={`flex items-center gap-2 px-4 py-3 font-medium whitespace-nowrap ${
              activeTab === 'shopping'
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingCart size={20} />
            Список покупок
            <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full ml-1">
              {shoppingItems.length}
            </span>
          </button>
        </div>

        {/* Контент */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : activeTab === 'fridge' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fridgeItems.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Fridge className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Холодильник пуст</h3>
                <p className="text-gray-500">Добавьте первые продукты!</p>
              </div>
            ) : (
              fridgeItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow animate-fadeIn"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {item.products?.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-gray-600 text-sm">
                          Количество: {item.quantity} {item.products?.unit}
                        </span>
                      </div>
                      {item.expiry_date && (
                        <div className="mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            new Date(item.expiry_date) < new Date(Date.now() + 3 * 86400000)
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            📅 {new Date(item.expiry_date).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveToShopping(item.product_id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Добавить в покупки"
                      >
                        <ShoppingCart size={18} />
                      </button>
                      <button
                        onClick={() => removeFromFridge(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
                    <span>Добавлено: {new Date(item.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {shoppingItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Список покупок пуст</h3>
                <p className="text-gray-500">Добавьте продукты из холодильника или вручную</p>
              </div>
            ) : (
              shoppingItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all animate-fadeIn"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => markAsPurchased(item.id)}
                      className="flex-shrink-0 w-7 h-7 border-2 border-gray-300 rounded-full flex items-center justify-center hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      {item.purchased ? (
                        <Check size={16} className="text-green-500" />
                      ) : null}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {item.products?.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-gray-600 text-sm">
                          {item.quantity} {item.products?.unit}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.priority === 1 ? 'bg-red-100 text-red-800' :
                          item.priority === 2 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {item.priority === 1 ? 'Срочно' : 
                           item.priority === 2 ? 'Средне' : 'Когда будет'}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeFromShopping(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Модалка добавления */}
        <dialog id="add-product-modal" className="rounded-xl shadow-2xl backdrop:bg-black/30">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Добавить продукт</h3>
            
            <form onSubmit={addProduct}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название продукта
                  </label>
                  <input
                    type="text"
                    value={newProduct}
                    onChange={(e) => setNewProduct(e.target.value)}
                    placeholder="Например: молоко, хлеб, яйца..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Количество
                  </label>
                  <input
                    type="number"
                    min="1"
                    defaultValue="1"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => document.getElementById('add-product-modal')?.close()}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </dialog>
      </main>

      {/* Плавающая кнопка добавления */}
      <button
        onClick={() => document.getElementById('add-product-modal')?.showModal()}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-20"
      >
        <Plus size={24} />
      </button>

      {/* Баннер установки PWA */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-30 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="text-blue-600" size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Установить приложение</h4>
                <p className="text-sm text-gray-600">Быстрый доступ с главного экрана</p>
              </div>
            </div>
            <button
              onClick={installPWA}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Установить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
