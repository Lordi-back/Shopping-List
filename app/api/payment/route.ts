import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || ''
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { userId, returnUrl } = await req.json()

    // Создаём платёж в ЮKassa
    const payment = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64'),
        'Idempotence-Key': Date.now().toString(),
      },
      body: JSON.stringify({
        amount: {
          value: '149.00',
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: returnUrl || 'https://shoppinglist-navy.vercel.app/subscription',
        },
        description: 'Подписка Семейный холодильник на 30 дней',
        metadata: { userId },
      }),
    })

    const data = await payment.json()

    if (data.confirmation?.confirmation_url) {
      return NextResponse.json({ url: data.confirmation.confirmation_url, paymentId: data.id })
    }

    return NextResponse.json({ error: 'Не удалось создать платёж' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
