import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Семейный холодильник',
  description: 'Учет продуктов для всей семьи',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
  appleWebApp: {
    capable: true,
    title: 'Холодильник',
    statusBarStyle: 'default',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={inter.className}>
        {children}
        
        {/* PWA инсталляция */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
              
              // Установка PWA
              let deferredPrompt;
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                
                // Показать кнопку установки
                const installBtn = document.createElement('button');
                installBtn.textContent = 'Установить приложение';
                installBtn.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg';
                installBtn.onclick = () => {
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then(() => {
                    deferredPrompt = null;
                  });
                };
                document.body.appendChild(installBtn);
                
                // Авто-скрыть через 10 секунд
                setTimeout(() => installBtn.remove(), 10000);
              });
            `,
          }}
        />
      </body>
    </html>
  )
}
