import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rkbrxjbtilumisyeenlu.supabase.co'
const supabaseKey = 'sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ============ ТИПЫ ============

export type Product = {
  id: string
  name: string
  category: 'products' | 'household'
  unit: string
  icon?: string
  barcode?: string
  created_at?: string
}

export type ShoppingItem = {
  id: string
  product_id: string
  family_id?: string
  quantity: number
  priority: number
  purchased: boolean
  added_by?: string
  purchased_by?: string
  purchased_at?: string
  category: 'products' | 'household'
  notes?: string
  created_at: string
  updated_at?: string
  // Join
  products?: Product
}

export type FridgeItem = {
  id: string
  product_id: string
  family_id?: string
  quantity: number
  expiry_date?: string
  added_by?: string
  notes?: string
  created_at: string
 purchased_at?: string | null
  products?: Product
}

export type UserSyncCode = {
  id: string
  user_id: string
  sync_code: string
  telegram_chat_id?: number
  telegram_username?: string
  created_at: string
  last_used?: string
}

export type ChatMessage = {
  id?: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: string
}

export type Notification = {
  id?: string
  user_id: string
  type: 'success' | 'warning' | 'info' | 'error'
  message: string
  read?: boolean
  created_at?: string
}

export type PurchaseHistory = {
  id?: string
  user_id: string
  product_name: string
  category?: string
  purchased_at?: string
}
