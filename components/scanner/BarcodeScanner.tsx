'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

type BarcodeScannerProps = {
  onScan: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromVideoDevice(
        undefined, // авто-выбор камеры (обычно задняя)
        videoRef.current!,
        (result, err) => {
          if (result && !scanned) {
            setScanned(true)
            onScan(result.getText())
          }
          if (err && !(err as any)?.message?.includes('multi_format')) {
            // Игнорируем некритичные ошибки сканирования
          }
        }
      )
      .catch((err) => {
        setError('Нет доступа к камере. Разрешите использование камеры в настройках браузера.')
        console.error('Ошибка камеры:', err)
      })

    return () => {
      reader.reset()
    }
  }, [onScan, scanned])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-4 text-white">
        <h3 className="text-lg font-medium">Сканер штрихкода</h3>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl hover:bg-white/30 transition-all"
        >
          ✕
        </button>
      </div>

      {/* Видео */}
      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="text-center text-white">
            <p className="text-4xl mb-4">📷❌</p>
            <p className="text-sm mb-4">{error}</p>
            <button onClick={onClose} className="btn bg-white text-gray-800 px-6 py-3 rounded-2xl">
              Закрыть
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-sm aspect-square">
            <video
              ref={videoRef}
              className="w-full h-full object-cover rounded-3xl"
              playsInline
            />
            {/* Рамка сканирования */}
            <div className="absolute inset-4 border-2 border-white/60 rounded-2xl pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-warm-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-warm-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-warm-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-warm-500 rounded-br-xl" />
            </div>
            {/* Индикатор сканирования */}
            {!scanned && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 rounded-full text-white text-sm">
                Наведите на штрихкод
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ручной ввод */}
      <div className="p-4">
        <button
          onClick={() => {
            const code = prompt('Введите штрихкод вручную:')
            if (code?.trim()) {
              onScan(code.trim())
            }
          }}
          className="btn bg-white/20 text-white w-full py-3 rounded-2xl text-sm hover:bg-white/30 transition-all"
        >
          ✍️ Ввести штрихкод вручную
        </button>
      </div>
    </div>
  )
}
