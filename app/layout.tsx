import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { StoreProvider } from '@/lib/store'
import { AppShell } from '@/components/ui/AppShell'

export const metadata: Metadata = {
  title: 'Семейный холодильник',
  description: 'Умный список покупок с AI-ассистентом',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2D6A4F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ToastProvider>
          <StoreProvider>
            <main className="min-h-screen pb-20">{children}</main>
            <AppShell />
          </StoreProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
