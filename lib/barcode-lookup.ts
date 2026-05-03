import { supabase } from './supabase'

type LookupResult = {
  name: string
  category: 'products' | 'household'
  icon: string
  imageUrl?: string
}

// Категории бытовой химии в Open Food Facts
const HOUSEHOLD_CATEGORIES = [
  'cleaning',
  'hygiene',
  'household',
  'detergent',
  'personal-care',
  'toiletries',
  'baby-care',
  'pet-care',
]

/**
 * Ищет товар по штрихкоду:
 * 1. Локальная база
 * 2. Open Food Facts API
 * 3. AI (позже)
 */
export async function lookupByBarcode(barcode: string): Promise<LookupResult | null> {
  // 1. Ищем в локальной базе
  const { data: local } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .single()

  if (local) {
    return {
      name: local.name,
      category: (local.category as 'products' | 'household') || 'products',
      icon: local.icon || '📦',
    }
  }

  // 2. Open Food Facts API
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name_ru,product_name,categories_tags,image_url`
    )
    const data = await res.json()

    if (data.product && data.product.product_name_ru) {
      const category = detectCategory(data.product.categories_tags || [])
      const result: LookupResult = {
        name: data.product.product_name_ru || data.product.product_name,
        category,
        icon: category === 'household' ? '🧹' : '🛒',
        imageUrl: data.product.image_url || undefined,
      }

      // Сохраняем в локальную базу для будущих сканов
      await supabase.from('products').insert({
        name: result.name,
        category: result.category,
        icon: result.icon,
        barcode,
      })

      // Логируем скан
      await supabase.from('scanned_items').upsert({
        user_id: 'temp', // заменим когда будет auth
        barcode,
        product_name: result.name,
        category: result.category,
        image_url: result.imageUrl || null,
        scan_count: 1,
      })

      return result
    }
  } catch (err) {
    console.error('Ошибка Open Food Facts:', err)
  }

  // 3. Не найдено — предлагаем ввести вручную
  return null
}

/**
 * Определяет категорию по тегам Open Food Facts
 */
function detectCategory(tags: string[]): 'products' | 'household' {
  const lowerTags = tags.map((t) => t.toLowerCase())
  const isHousehold = lowerTags.some((tag) =>
    HOUSEHOLD_CATEGORIES.some((cat) => tag.includes(cat))
  )
  return isHousehold ? 'household' : 'products'
}
