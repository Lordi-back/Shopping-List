import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/ToastProvider'

export const metadata: Metadata = {
  title: 'Семейный холодильник',
  description: 'Умный список покупок с AI-ассистентом',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2D6A4F',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        <ToastProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  )
}
