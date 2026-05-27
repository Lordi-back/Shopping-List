'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/ui/ToastProvider'
import { getDeviceId } from '@/lib/family'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function RecipesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [fridgeEmpty, setFridgeEmpty] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { addItem } = useStore()
  const { showToast } = useToast()

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initChat = async () => {
    setLoading(true)

    const { data: fridgeItems } = await supabase
      .from('fridge_items')
      .select('quantity, products(name)')

    const ingredients = fridgeItems?.map((f: any) => f.products?.name).filter(Boolean) || []

    if (ingredients.length === 0) {
      setFridgeEmpty(true)
      setMessages([{
        role: 'assistant',
        content: `👨‍🍳 **Шеф-помощник**\n\nХолодильник пока пуст.\n\nЯ умею:\n🛒 «Добавь молоко» — добавить в список\n🍳 «Что приготовить?» — подобрать рецепт\n📋 «Покажи список» — что купить\n✅ «Молоко купил» — отметить`,
      }])
    } else {
      setFridgeEmpty(false)
      setMessages([{
        role: 'assistant',
        content: `👨‍🍳 **Шеф-помощник**\n\n🥗 В холодильнике: ${ingredients.join(', ')}\n\nСпроси:\n• «Что приготовить?»\n• «Добавь хлеб»\n• «Покажи список»`,
      }])
    }

    setLoading(false)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          currentList: [],
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Ошибка: ' + data.error }])
      } else {
        // Выполняем действия (добавление товаров)
        if (data.actions) {
          for (const action of data.actions) {
            if (action.type === 'add_items') {
              for (const item of action.items) {
                const familyId = localStorage.getItem('family_id') || ''
await addItem(item.name, item.category || 'products', item.quantity || 1, familyId)
                showToast('success', `✅ ${item.name} добавлен в список`)
              }
            }
          }
        }
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Не удалось связаться.' }])
    }

    setLoading(false)
  }

  const handleQuickAsk = (question: string) => {
    setInput(question)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col h-[calc(100vh-5rem)]">
      <h1 className="text-2xl font-bold text-gray-800 mb-3">👨‍🍳 Шеф-помощник</h1>

      {/* Быстрые кнопки */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => handleQuickAsk('Что приготовить?')} className="btn btn-outline text-xs py-1.5 px-3">
          🍽 Что приготовить?
        </button>
        <button onClick={() => handleQuickAsk('Добавь молоко')} className="btn btn-outline text-xs py-1.5 px-3">
          🛒 Добавить
        </button>
        <button onClick={() => handleQuickAsk('Покажи список')} className="btn btn-outline text-xs py-1.5 px-3">
          📋 Список
        </button>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-fridge-500 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Ввод */}
      <div className="flex gap-2 pb-20">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Добавь молоко или спроси рецепт..."
          className="input flex-1 text-sm"
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()} className="btn btn-primary px-5">
          ➤
        </button>
      </div>
    </div>
  )
}
