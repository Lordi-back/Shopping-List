import './globals.css' // Если есть стили
import { Inter } from 'next/font/google'
import React from 'react'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'Семейный холодильник',
  description: 'Общий список покупок для всей семьи',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
