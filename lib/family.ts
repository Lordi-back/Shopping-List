import { supabase } from './supabase'

export function generateFamilyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function createFamily(userId: string): Promise<{ familyId: string; code: string }> {
  const code = generateFamilyCode()
  
  // Создаём семью
  const { data: family } = await supabase
    .from('families')
    .insert({
      name: 'Моя семья',
      invite_code: code,
    })
    .select()
    .single()

  if (!family) throw new Error('Не удалось создать семью')

  // Привязываем пользователя
  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + 14)

  await supabase
    .from('users')
    .update({
      family_id: family.id,
      trial_ends: trialEnds.toISOString(),
      subscription_status: 'trial',
    })
    .eq('id', userId)

  return { familyId: family.id, code }
}

export async function joinFamily(userId: string, code: string): Promise<boolean> {
  const { data: family } = await supabase
    .from('families')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (!family) return false

  await supabase
    .from('users')
    .update({ family_id: family.id })
    .eq('id', userId)

  return true
}

export async function getOrCreateFamily(userId: string): Promise<string> {
  // Проверяем, есть ли у пользователя семья
  const { data: user } = await supabase
    .from('users')
    .select('family_id, role, trial_ends, subscription_status')
    .eq('id', userId)
    .single()

  if (user?.family_id) {
    // Если админ или подписка активна — продлеваем триал
    if (user.role === 'admin' || user.subscription_status === 'active') {
      return user.family_id
    }
    // Если триал не истёк
    if (user.trial_ends && new Date(user.trial_ends) > new Date()) {
      return user.family_id
    }
    // Триал истёк, но family_id остаётся (просто не можем добавлять)
    return user.family_id
  }

  // Создаём новую семью
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

  // Админ — всё можно
  if (user.role === 'admin') return { status: 'admin' }

  // Активная подписка
  if (user.subscription_status === 'active') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('valid_until')
      .eq('user_id', userId)
      .single()

    if (sub?.valid_until && new Date(sub.valid_until) > new Date()) {
      return { status: 'active' }
    }
  }

  // Триал
  if (user.subscription_status === 'trial' && user.trial_ends) {
    const daysLeft = Math.ceil(
      (new Date(user.trial_ends).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft > 0) {
      return { status: 'trial', trialEnds: user.trial_ends, daysLeft }
    }
  }

  return { status: 'expired' }
}
