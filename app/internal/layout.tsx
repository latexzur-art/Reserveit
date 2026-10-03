"use client"

import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { useUI } from '@/contexts/UIContext'
import { cn } from '@/lib/utils'

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const { textSizeEnlarged } = useUI()

  return (
    <div className={cn(
        "min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200",
        textSizeEnlarged && "text-enlarged"
    )}>
      <ErrorBoundary>{children}</ErrorBoundary>
      <Toaster />
    </div>
  )
}
