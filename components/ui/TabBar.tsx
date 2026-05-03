'use client'

type Tab = {
  id: string
  label: string
  icon: string
  count?: number
}

type TabBarProps = {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            text-sm font-medium transition-all duration-200
            ${
              activeTab === tab.id
                ? 'bg-white text-fridge-500 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-warm-500 rounded-full">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
