'use client'

import { BottomNav } from './BottomNav'
import { ChatWidget } from '@/components/chat/ChatWidget'

export function AppShell() {
  return (
    <>
      <BottomNav />
      <ChatWidget items={[]} onExecuteAction={(action) => console.log('AI action:', action)} />
    </>
  )
}
