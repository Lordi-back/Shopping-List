'use client'

import { BottomNav } from './BottomNav'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { useStore } from '@/lib/store'

export function AppShell() {
  const { items, addItem } = useStore()

  return (
    <>
      <BottomNav />
      <ChatWidget
        items={items}
        onExecuteAction={async (action: any) => {
          if (action.type === 'add_items') {
            for (const item of action.items) {
              await addItem(item.name, item.category || 'products', item.quantity || 1)
            }
          }
        }}
      />
    </>
  )
}
