"use client"

import React from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'
import { FacultySidebar } from './_components/FacultySidebar'
import { FacultyLayoutProvider, useFacultyLayout } from './_components/FacultyLayoutContext'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { useUI } from '@/contexts/UIContext'
import { cn } from '@/lib/utils'
import { AssistantMount } from '@/components/ai/AssistantMount'

function FacultyLayoutInner({ children }: { children: React.ReactNode }) {
  const { mobileMenuOpen, setMobileMenuOpen, toggleMobileMenu } = useFacultyLayout()
  const { textSizeEnlarged } = useUI()

  return (
    <div className={cn(
        "flex h-screen w-full overflow-hidden transition-colors duration-500 font-sans bg-slate-50 dark:bg-[#0B0E11] text-slate-900 dark:text-slate-100",
        textSizeEnlarged && "text-enlarged"
    )}>
      <FacultySidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Universal Mobile Toggle — fallback for pages without a TopBar */}
        <div className="lg:hidden fixed top-3 left-3 z-[45]">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMobileMenu}
            className="h-9 w-9 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-border shadow-lg"
          >
            <Menu className="h-4.5 w-4.5" />
          </Button>
        </div>

        <main className="flex-1 overflow-auto">
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

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <FacultyLayoutProvider>
        <FacultyLayoutInner>{children}</FacultyLayoutInner>
      </FacultyLayoutProvider>
    </ThemeProvider>
  )
}
