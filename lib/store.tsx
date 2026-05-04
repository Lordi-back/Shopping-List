'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ShoppingItem, supabase } from './supabase'

type StoreContextType = {
  items: ShoppingItem[]
  loadItems: () => Promise<void>
  addItem: (name: string, category: 'products' | 'household', quantity: number) => Promise<void>
}

const StoreContext = createContext<StoreContextType>({
  items: [],
  loadItems: async () => {},
  addItem: async () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShoppingItem[]>([])

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from('shopping_list')
      .select('*, products(*)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setItems(data as ShoppingItem[])
  }, [])

  const addItem = useCallback(async (name: string, category: 'products' | 'household', quantity: number) => {
    const cleanName = name.trim().toLowerCase()
    
    // Ищем продукт с таким же именем (игнорируем регистр)
    const { data: existingProduct } = await supabase
      .from('products')
      .select('*')
      .ilike('name', cleanName)
      .eq('category', category)
      .maybeSingle()

    let productId: string

    if (existingProduct) {
      productId = existingProduct.id
    } else {
      // Пробуем создать — если ошибка duplicate, просто игнорируем и ищем снова
      try {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({
            name: cleanName,
            category,
            unit: 'шт.',
            icon: category === 'products' ? '🛒' : '🧹',
          })
          .select()
          .maybeSingle()

        if (error && error.code === '23505') {
          // Duplicate — ищем ещё раз (гонка состояний)
          const { data: retryProduct } = await supabase
            .from('products')
            .select('*')
            .ilike('name', cleanName)
            .eq('category', category)
            .maybeSingle()
          
          if (!retryProduct) return
          productId = retryProduct.id
        } else if (newProduct) {
          productId = newProduct.id
        } else {
          return
        }
      } catch {
        return
      }
    }

    // Добавляем в список
    const { data: addedItem } = await supabase
      .from('shopping_list')
      .insert({
        product_id: productId,
        quantity,
        priority: 1,
        purchased: false,
        category,
      })
      .select('*, products(*)')
      .maybeSingle()

    if (addedItem) {
      setItems((prev) => [addedItem as ShoppingItem, ...prev])
    }
  }, [])

  return (
    <StoreContext.Provider value={{ items, loadItems, addItem }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
