'use client'

import { useState, useRef, useEffect } from 'react'
import { ShoppingItem } from '@/lib/supabase'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ChatWidgetProps = {
  items: ShoppingItem[]
  onExecuteAction: (action: any) => void
}

export function ChatWidget({ items, onExecuteAction }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Привет! Я твой умный помощник. Спроси меня про список покупок или рецепты! 🛒' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const currentList = items.map((item) => ({
        name: item.products?.name || 'Товар',
        category: item.category || 'products',
        quantity: item.quantity,
        purchased: item.purchased,
      }))

      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          currentList,
          history,
        }),
      })

      const data = await res.json()

      if (data.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Ошибка: ' + data.error }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])

        if (data.actions) {
          for (const action of data.actions) {
            onExecuteAction(action)
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Не удалось связаться с помощником.' }])
    }

    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Кнопка открытия */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 w-14 h-14 rounded-2xl bg-fridge-500 text-white shadow-lg flex items-center justify-center text-2xl hover:bg-fridge-600 transition-all active:scale-95 z-40"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Панель чата */}
      {isOpen && (
        <div className="fixed bottom-36 right-6 w-[calc(100vw-3rem)] sm:w-96 h-[450px] max-h-[calc(100vh-12rem)] bg-white rounded-2xl shadow-2xl flex flex-col z-40 animate-slide-up border border-gray-100">
          {/* Заголовок */}
          <div className="flex items-center gap-2 p-4 border-b border-gray-100">
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="font-semibold text-sm">AI-помощник</h3>
              <p className="text-xs text-gray-400">Всегда на связи</p>
            </div>
          </div>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-fridge-500 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Ввод */}
          <div className="p-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напиши сообщение..."
                className="input flex-1 text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="btn btn-primary px-4"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
