import { supabase } from './supabase'

const DEVICE_ID_KEY = 'fridge_device_id'

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export function generateFamilyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function createFamily(userId: string): Promise<{ familyId: string }> {
  const { data: family } = await supabase
    .from('families')
    .insert({ name: 'Моя семья' })
    .select()
    .single()

  if (!family) throw new Error('Не удалось создать семью')

  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + 14)

  await supabase.from('users').update({
    family_id: family.id,
    trial_ends: trialEnds.toISOString(),
    subscription_status: 'trial',
  }).eq('id', userId)

  await addDeviceToFamily(family.id, userId)

  return { familyId: family.id }
}

export async function generateAndBindCode(familyId: string, deviceId: string): Promise<string> {
  const { data: family } = await supabase
    .from('families')
    .select('invite_code')
    .eq('id', familyId)
    .single()

  if (family?.invite_code) {
    throw new Error('Код уже сгенерирован')
  }

  const code = generateFamilyCode()

  const { error } = await supabase
    .from('families')
    .update({ invite_code: code })
    .eq('id', familyId)

  if (error) throw new Error('Не удалось сохранить код')

  return code
}

export async function joinFamily(userId: string, code: string): Promise<{ success: boolean; message: string }> {
  const cleanCode = code.toUpperCase().trim()

  const { data: family } = await supabase
    .from('families')
    .select('*')
    .eq('invite_code', cleanCode)
    .single()

  if (!family) return { success: false, message: 'Код не найден' }

  const { count } = await supabase
    .from('family_devices')
    .select('*', { count: 'exact', head: true })
    .eq('family_id', family.id)

  const MAX_DEVICES = 5
  if (count && count >= MAX_DEVICES) {
    return { success: false, message: `Достигнут лимит (${MAX_DEVICES} устройств)` }
  }

  const { data: existing } = await supabase
    .from('family_devices')
    .select('*')
    .eq('family_id', family.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return { success: false, message: 'Вы уже в этой семье' }
  }

  await supabase.from('users').update({ family_id: family.id }).eq('id', userId)
  await addDeviceToFamily(family.id, userId)

  return { success: true, message: '✅ Подключено к семье!' }
}

export async function leaveFamily(userId: string): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .single()

  if (user?.family_id) {
    await supabase
      .from('family_devices')
      .delete()
      .eq('family_id', user.family_id)
      .eq('user_id', userId)

    await supabase
      .from('users')
      .update({ family_id: null })
      .eq('id', userId)
  }
}

export async function getFamilyDevices(familyId: string): Promise<any[]> {
  const { data } = await supabase
    .from('family_devices')
    .select('*, users(first_name, username)')
    .eq('family_id', familyId)
    .order('added_at', { ascending: true })

  return data || []
}

async function addDeviceToFamily(familyId: string, userId: string) {
  const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : 'Устройство'
  await supabase.from('family_devices').insert({
    family_id: familyId,
    user_id: userId,
    device_name: deviceName,
  })
}

export async function getOrCreateFamily(userId: string): Promise<string> {
  const { data: user } = await supabase
    .from('users')
    .select('family_id, role, trial_ends, subscription_status')
    .eq('id', userId)
    .single()

  if (user?.family_id) return user.family_id

  const { familyId } = await createFamily(userId)
  return familyId
}

export async function checkSubscriptionStatus(userId: string): Promise<{
  status: 'trial' | 'active' | 'expired' | 'admin'
  trialEnds?: string
  daysLeft?: number
}> {
  const { data: user } = await supabase
    .from('users')
    .select('role, subscription_status, trial_ends')
    .eq('id', userId)
    .single()

  if (!user) return { status: 'expired' }
  if (user.role === 'admin') return { status: 'admin' }

  if (user.subscription_status === 'active') return { status: 'active' }

  if (user.subscription_status === 'trial' && user.trial_ends) {
    const daysLeft = Math.ceil(
      (new Date(user.trial_ends).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft > 0) return { status: 'trial', trialEnds: user.trial_ends, daysLeft }
  }

  return { status: 'expired' }
}
