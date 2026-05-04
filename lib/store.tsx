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
    const { data: existingProduct } = await supabase
      .from('products')
      .select('*')
      .ilike('name', name)
      .maybeSingle()

    let productId: string

    if (existingProduct) {
      productId = existingProduct.id
    } else {
      const { data: newProduct } = await supabase
        .from('products')
        .insert({
          name,
          category,
          unit: 'шт.',
          icon: category === 'products' ? '🛒' : '🧹',
        })
        .select()
        .maybeSingle()

      if (!newProduct) return
      productId = newProduct.id
    }

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
