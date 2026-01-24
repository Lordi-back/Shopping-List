import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://rkbrxjbtilumisyeenlu.supabase.co'
const supabaseKey = 'sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Типы данных


export interface Family {
  id: string
  name: string
  invite_code: string
}


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
