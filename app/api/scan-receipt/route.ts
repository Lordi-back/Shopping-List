import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Нет файла' }, { status: 400 })
    }

    // Сохраняем файл временно
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const tempPath = join('/tmp', `receipt_${Date.now()}.jpg`)
    writeFileSync(tempPath, buffer)

    // Запускаем Python-скрипт
    const { stdout, stderr } = await execAsync(`python3 receipt_scanner.py "${tempPath}"`)

    // Удаляем временный файл
    try { unlinkSync(tempPath) } catch {}

    if (stderr) {
      console.error('Python error:', stderr)
    }

    const items = JSON.parse(stdout)

    return NextResponse.json({ items })

  } catch (error: any) {
    console.error('Ошибка сканирования чека:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка обработки' },
      { status: 500 }
    )
  }
}
