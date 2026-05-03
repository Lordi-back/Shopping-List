import { supabase } from './supabase'

const DEVICE_ID_KEY = 'fridge_device_id'
const SUBSCRIPTION_CODE_KEY = 'fridge_subscription_code'

/**
 * Генерирует уникальный ID устройства
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

/**
 * Генерирует код подписки (8 символов)
 */
export function generateSubscriptionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Сохраняет код подписки на устройстве
 */
export function saveSubscriptionCode(code: string) {
  localStorage.setItem(SUBSCRIPTION_CODE_KEY, code)
}

/**
 * Получает сохранённый код подписки
 */
export function getSavedSubscriptionCode(): string | null {
  return localStorage.getItem(SUBSCRIPTION_CODE_KEY)
}

/**
 * Создаёт новую подписку (после оплаты)
 */
export async function createSubscription(userId: string): Promise<{ code: string; validUntil: string }> {
  const code = generateSubscriptionCode()
  const validUntil = new Date()
  validUntil.setMonth(validUntil.getMonth() + 1) // +30 дней

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      status: 'active',
      code,
      max_devices: 5,
      valid_until: validUntil.toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  // Привязываем текущее устройство
  await addDeviceToSubscription(data.id, getDeviceId())

  saveSubscriptionCode(code)

  return {
    code,
    validUntil: validUntil.toISOString(),
  }
}

/**
 * Привязывает устройство к подписке по коду
 */
export async function joinSubscriptionByCode(code: string): Promise<{
  success: boolean
  message: string
  devicesUsed?: number
  maxDevices?: number
}> {
  // Ищем подписку по коду
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !subscription) {
    return { success: false, message: 'Код не найден. Проверьте правильность.' }
  }

  if (subscription.status !== 'active') {
    return { success: false, message: 'Подписка не активна.' }
  }

  if (new Date(subscription.valid_until) < new Date()) {
    return { success: false, message: 'Срок подписки истёк.' }
  }

  // Проверяем количество устройств
  const { count } = await supabase
    .from('subscription_devices')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_id', subscription.id)

  const deviceId = getDeviceId()

  // Проверяем, не привязано ли уже это устройство
  const { data: existing } = await supabase
    .from('subscription_devices')
    .select('*')
    .eq('subscription_id', subscription.id)
    .eq('device_id', deviceId)
    .single()

  if (existing) {
    saveSubscriptionCode(code)
    return {
      success: true,
      message: 'Устройство уже привязано!',
      devicesUsed: count || 1,
      maxDevices: subscription.max_devices,
    }
  }

  if (count && count >= subscription.max_devices) {
    return {
      success: false,
      message: `Достигнут лимит устройств (${subscription.max_devices}). Освободите одно из устройств.`,
      devicesUsed: count,
      maxDevices: subscription.max_devices,
    }
  }

  // Привязываем устройство
  const { error: addError } = await supabase
    .from('subscription_devices')
    .insert({
      subscription_id: subscription.id,
      device_id: deviceId,
      device_name: navigator.userAgent.slice(0, 100),
    })

  if (addError) {
    return { success: false, message: 'Ошибка привязки устройства.' }
  }

  saveSubscriptionCode(code)

  return {
    success: true,
    message: 'Устройство привязано!',
    devicesUsed: (count || 0) + 1,
    maxDevices: subscription.max_devices,
  }
}

/**
 * Привязывает устройство к существующей подписке (по ID)
 */
async function addDeviceToSubscription(subscriptionId: string, deviceId: string) {
  await supabase.from('subscription_devices').insert({
    subscription_id: subscriptionId,
    device_id: deviceId,
    device_name: navigator.userAgent.slice(0, 100),
  })
}

/**
 * Проверяет активность подписки на текущем устройстве
 */
export async function checkSubscription(): Promise<{
  active: boolean
  code?: string
  validUntil?: string
  devicesUsed?: number
  maxDevices?: number
}> {
  const savedCode = getSavedSubscriptionCode()
  if (!savedCode) return { active: false }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('code', savedCode)
    .single()

  if (!subscription || subscription.status !== 'active') {
    return { active: false }
  }

  if (new Date(subscription.valid_until) < new Date()) {
    return { active: false }
  }

  const { count } = await supabase
    .from('subscription_devices')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_id', subscription.id)

  return {
    active: true,
    code: subscription.code,
    validUntil: subscription.valid_until,
    devicesUsed: count || 0,
    maxDevices: subscription.max_devices,
  }
}

/**
 * Имитация оплаты (заглушка)
 */
export async function mockPayment(userId: string): Promise<{ success: boolean; code: string }> {
  // Имитируем задержку оплаты
  await new Promise(resolve => setTimeout(resolve, 1500))

  const { code } = await createSubscription(userId)

  return { success: true, code }
}

/**
 * Форматирует дату
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
