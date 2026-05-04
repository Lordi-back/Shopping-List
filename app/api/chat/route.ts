import { NextRequest, NextResponse } from 'next/server'
import { chatWithAI } from '@/lib/ai-assistant'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, currentList, history } = body

    if (!message) {
      return NextResponse.json({ error: 'Нет сообщения' }, { status: 400 })
    }

    const response = await chatWithAI(
      message,
      currentList || [],
      history || []
    )

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Ошибка обработки:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка обработки' },
      { status: 500 }
    )
  }
}
