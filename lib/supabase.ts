import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Типы
export type Product = {
  id: string
  name: string
  category: string
  unit: string
  icon?: string
}

export type FridgeItem = {
  id: string
  product_id: string
  quantity: number
  expiry_date?: string
  added_by?: string
  created_at: string
  products?: Product
}

export type ShoppingItem = {
  id: string
  product_id: string
  quantity: number
  priority: number
  added_by?: string
  purchased: boolean
  created_at: string
  products?: Product
}
