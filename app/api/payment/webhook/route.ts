import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Проверяем, что платёж успешен
    if (body.event === 'payment.succeeded' && body.object?.status === 'succeeded') {
      const userId = body.object.metadata?.userId

      if (userId) {
        // Активируем подписку на 30 дней
        const validUntil = new Date()
        validUntil.setDate(validUntil.getDate() + 30)

        await supabase.from('users').update({
          subscription_status: 'active',
          trial_ends: validUntil.toISOString(),
        }).eq('id', userId)

        // Создаём запись в subscriptions
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (existingSub) {
          await supabase.from('subscriptions').update({
            status: 'active',
            valid_until: validUntil.toISOString(),
          }).eq('id', existingSub.id)
        } else {
          await supabase.from('subscriptions').insert({
            user_id: userId,
            status: 'active',
            valid_until: validUntil.toISOString(),
          })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
