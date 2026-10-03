'use client'

import { cn } from '@/lib/utils'
import { useUI } from '@/contexts/UIContext'
import { UserManagerSidebar } from './UserManagerSidebar'
import { UserManagerHeader } from './UserManagerHeader'

export function UserManagerLayout({ children }: { children: React.ReactNode }) {
  const { textSizeEnlarged } = useUI()

  return (
    <div className={cn(
      'flex h-screen w-full bg-[#f8fafc] dark:bg-[#0D0F12] overflow-hidden font-sans transition-all duration-200',
      textSizeEnlarged && 'text-enlarged'
    )}>
      <UserManagerSidebar />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <UserManagerHeader />
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/50 dark:bg-transparent">
          <div className="max-w-[1600px] mx-auto p-4 sm:p-8 lg:p-12">
            {children}
            {/* Spacer to prevent fixed floating actions from overlapping bottom content */}
            <div className="h-24 shrink-0" aria-hidden="true" />
          </div>
        </main>
      </div>
    </div>
  )
}
