'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Список', icon: '🏠' },
  { href: '/recipes', label: 'Рецепты', icon: '🍳' },
  { href: '/subscription', label: 'Premium', icon: '🏆' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-30">
      <div className="max-w-lg mx-auto flex items-center justify-around px-4 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center gap-1 px-4 py-2 rounded-2xl
                transition-all duration-200
                ${isActive ? 'text-fridge-500 bg-fridge-50' : 'text-gray-400 hover:text-gray-600'}
              `}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
