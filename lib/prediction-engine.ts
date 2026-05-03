import { supabase } from './supabase'

export type PredictedItem = {
  product_name: string
  avg_interval_days: number
  next_purchase_date: string
  confidence: number
}

export type Reminder = {
  product_name: string
  message: string
  confidence: number
}

/**
 * Анализирует историю покупок и предсказывает, когда пора пополнить запасы
 */
export async function analyzeUserPurchases(userId: string): Promise<PredictedItem[]> {
  // Получаем историю покупок за последние 90 дней
  const { data: history } = await supabase
    .from('purchase_history')
    .select('*')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: true })

  if (!history || history.length < 3) return []

  // Группируем по названию товара
  const groups = groupByProductName(history)
  const predictions: PredictedItem[] = []

  for (const [productName, purchases] of Object.entries(groups)) {
    if (purchases.length < 2) continue

    // Вычисляем интервалы между покупками
    const intervals: number[] = []
    for (let i = 1; i < purchases.length; i++) {
      const days = daysBetween(
        new Date(purchases[i - 1].purchased_at),
        new Date(purchases[i].purchased_at)
      )
      // Игнорируем интервалы больше 60 дней (скорее всего, забыли записать)
      if (days > 0 && days < 60) {
        intervals.push(days)
      }
    }

    if (intervals.length === 0) continue

    // Средний интервал
    const avgInterval = Math.round(mean(intervals))
    const stdDev = standardDeviation(intervals, avgInterval)

    // Уверенность: чем стабильнее интервалы, тем выше
    const confidence = Math.max(0, Math.min(1, 1 - stdDev / avgInterval))

    // Предсказываем следующую дату
    const lastPurchase = new Date(purchases[purchases.length - 1].purchased_at)
    const nextDate = new Date(lastPurchase)
    nextDate.setDate(nextDate.getDate() + avgInterval)

    predictions.push({
      product_name: productName,
      avg_interval_days: avgInterval,
      next_purchase_date: nextDate.toISOString(),
      confidence: Math.round(confidence * 100) / 100,
    })
  }

  // Сортируем: сначала те, что скоро закончатся
  return predictions.sort(
    (a, b) => new Date(a.next_purchase_date).getTime() - new Date(b.next_purchase_date).getTime()
  )
}

/**
 * Возвращает напоминания — товары, которые пора купить
 * (за 3 дня до ожидаемой даты или уже просроченные)
 */
export async function getReminders(userId: string): Promise<Reminder[]> {
  const predictions = await analyzeUserPurchases(userId)
  const now = new Date()
  const remindBefore = new Date()
  remindBefore.setDate(remindBefore.getDate() + 3) // за 3 дня

  return predictions
    .filter(p => {
      const nextDate = new Date(p.next_purchase_date)
      return nextDate <= remindBefore && p.confidence >= 0.5
    })
    .map(p => {
      const nextDate = new Date(p.next_purchase_date)
      const daysLeft = Math.round(daysBetween(now, nextDate))

      let urgency = ''
      if (daysLeft <= 0) {
        urgency = 'Уже пора купить!'
      } else if (daysLeft === 1) {
        urgency = 'Завтра пора покупать'
      } else {
        urgency = `Через ${daysLeft} дня`
      }

      return {
        product_name: p.product_name,
        message: `${urgency}. Обычно покупаешь каждые ${p.avg_interval_days} дн.`,
        confidence: p.confidence,
      }
    })
}

/**
 * Добавляет запись в историю покупок
 */
export async function recordPurchase(userId: string, productName: string, category?: string) {
  await supabase.from('purchase_history').insert({
    user_id: userId,
    product_name: productName,
    category: category || 'products',
  })
}

/**
 * Записывает несколько покупок сразу
 */
export async function recordPurchases(
  userId: string,
  items: { name: string; category: string }[]
) {
  const records = items.map(item => ({
    user_id: userId,
    product_name: item.name,
    category: item.category,
  }))

  if (records.length > 0) {
    await supabase.from('purchase_history').insert(records)
  }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function groupByProductName(history: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {}
  for (const record of history) {
    const name = normalizeProductName(record.product_name)
    if (!groups[name]) groups[name] = []
    groups[name].push(record)
  }
  return groups
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[.,!?]/g, '')
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function standardDeviation(values: number[], meanValue: number): number {
  const squaredDiffs = values.map(v => Math.pow(v - meanValue, 2))
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length)
}
