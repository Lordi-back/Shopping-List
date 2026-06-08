'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

type BarcodeScannerProps = {
  onScan: (barcode: string) => void
  onReceiptScan?: (items: any[]) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onReceiptScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)
  const [mode, setMode] = useState<'barcode' | 'receipt'>('barcode')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (mode === 'barcode') {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      reader
        .decodeFromVideoDevice(
          null,
          videoRef.current!,
          (result, err) => {
            if (result && !scanned) {
              setScanned(true)
              onScan(result.getText())
            }
            if (err && !(err as any)?.message?.includes('multi_format')) {
              // Игнорируем
            }
          }
        )
        .catch((err) => {
          setError('Нет доступа к камере.')
          console.error('Ошибка камеры:', err)
        })

      return () => {
        reader.reset()
      }
    }
  }, [onScan, scanned, mode])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onReceiptScan) return

    setProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else if (data.items?.length > 0) {
        onReceiptScan(data.items)
        onClose()
      } else {
        setError('Не удалось распознать товары в чеке')
      }
    } catch (err) {
      setError('Ошибка при обработке чека')
    }

    setProcessing(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-4 text-white">
        <h3 className="text-lg font-medium">
          {mode === 'barcode' ? 'Сканер штрихкода' : 'Сканер чека'}
        </h3>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl hover:bg-white/30 transition-all"
        >
          ✕
        </button>
      </div>

      {/* Переключатель режимов */}
      <div className="flex justify-center gap-2 px-4 mb-4">
        <button
          onClick={() => { setMode('barcode'); setScanned(false); setError(null) }}
          className={`px-4 py-2 rounded-xl text-sm transition-all ${
            mode === 'barcode' ? 'bg-white text-gray-800' : 'bg-white/20 text-white'
          }`}
        >
          📷 Штрихкод
        </button>
        <button
          onClick={() => { setMode('receipt'); setError(null) }}
          className={`px-4 py-2 rounded-xl text-sm transition-all ${
            mode === 'receipt' ? 'bg-white text-gray-800' : 'bg-white/20 text-white'
          }`}
        >
          🧾 Чек
        </button>
      </div>

      {/* Контент */}
      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="text-center text-white">
            <p className="text-4xl mb-4">❌</p>
            <p className="text-sm mb-4">{error}</p>
            <button onClick={onClose} className="btn bg-white text-gray-800 px-6 py-3 rounded-2xl">
              Закрыть
            </button>
          </div>
        ) : mode === 'receipt' ? (
          <div className="text-center">
            <p className="text-6xl mb-4">🧾</p>
            <p className="text-white text-sm mb-4">
              Сфотографируйте чек — мы распознаем товары
            </p>
            {processing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-white text-sm">Распознаём товары...</p>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn bg-white text-gray-800 px-6 py-3 rounded-2xl"
              >
                📸 Загрузить фото чека
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        ) : (
          <div className="relative w-full max-w-sm aspect-square">
            <video
              ref={videoRef}
              className="w-full h-full object-cover rounded-3xl"
              playsInline
            />
            <div className="absolute inset-4 border-2 border-white/60 rounded-2xl pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-warm-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-warm-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-warm-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-warm-500 rounded-br-xl" />
            </div>
            {!scanned && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 rounded-full text-white text-sm">
                Наведите на штрихкод
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ручной ввод для штрихкода */}
      {mode === 'barcode' && (
        <div className="p-4">
          <button
            onClick={() => {
              const code = prompt('Введите штрихкод вручную:')
              if (code?.trim()) onScan(code.trim())
            }}
            className="btn bg-white/20 text-white w-full py-3 rounded-2xl text-sm"
          >
            ✍️ Ввести штрихкод вручную
          </button>
        </div>
      )}
    </div>
  )
}
