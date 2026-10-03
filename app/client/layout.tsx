"use client"

import { usePathname } from 'next/navigation'
import { Toaster } from '@/components/ui/toaster'
import { ClientSidebar } from './_components/ClientSidebar'
import { ClientLayoutProvider } from './_components/ClientLayoutContext'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { useUI } from '@/contexts/UIContext'
import { cn } from '@/lib/utils'
import { AssistantMount } from '@/components/ai/AssistantMount'
import { ROUTES } from '@/lib/routes'

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const { textSizeEnlarged } = useUI()
  const pathname = usePathname()

  // Hide sidebar on login page
  const isLoginPage = pathname === ROUTES.client.login

  return (
    <div className={cn(
        "flex h-screen overflow-hidden bg-white dark:bg-card transition-all duration-200",
        textSizeEnlarged && "text-enlarged"
    )}>
      {/* FIX: Removed props. ClientSidebar now consumes ClientLayoutContext
          internally to handle mobile visibility.
      */}
      {!isLoginPage && <ClientSidebar />}

      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white dark:bg-card">
          <ErrorBoundary>
            {children}
            {/* Spacer to prevent fixed floating actions from overlapping bottom content */}
            <div className="h-24 shrink-0" aria-hidden="true" />
          </ErrorBoundary>
        </main>
      </div>
      <Toaster />
      <AssistantMount />
    </div>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientLayoutProvider>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </ClientLayoutProvider>
  )
}