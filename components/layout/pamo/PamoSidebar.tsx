'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Package, ClipboardList, Menu, X, Bell } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

const NAV = [
  { href: ROUTES.pamo.home, label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: ROUTES.pamo.notifications, label: 'Notifications', icon: Bell, exact: false },
  { href: ROUTES.pamo.equipment, label: 'Equipment', icon: Package, exact: false },
  { href: ROUTES.pamo.reports, label: 'Reports', icon: ClipboardList, exact: false },
]

function SidebarInner({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0D0F12]">
      <div className="flex items-center justify-between px-5 h-[70px] border-b border-neutral-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ReserveIT Logo" className="w-11 h-11 object-contain shrink-0" />
          <h1 className="font-black text-[#050d36] dark:text-white tracking-tighter text-[15px] uppercase leading-none mt-0.5">
            RESERVE<span className="text-yellow-500 dark:text-blue-400">IT</span>
          </h1>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-all"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        <p className="px-4 text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
          PAMO
        </p>
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative',
                isActive
                  ? 'bg-yellow-50 dark:bg-blue-600/10 text-yellow-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
              )}
            >
              {isActive && (
                <div className="absolute left-0 w-1 h-6 rounded-r-full bg-yellow-500 dark:bg-blue-600" />
              )}
              <Icon size={20} className={cn('shrink-0', isActive ? 'text-yellow-500 dark:text-blue-400' : '')} />
              <span className="text-xs font-black uppercase tracking-tight">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function PamoSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-[60]">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open menu"
              className="rounded-xl h-11 w-11 shadow-xl bg-white dark:bg-[#15181E] border-neutral-200 dark:border-white/5"
            >
              <Menu size={18} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-none bg-white dark:bg-[#0D0F12]" showCloseButton={false}>
            <SidebarInner onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden lg:flex flex-col h-screen w-64 sticky top-0 z-40 border-r border-neutral-200 dark:border-white/5 bg-white dark:bg-[#0D0F12] transition-all">
        <SidebarInner />
      </aside>
    </>
  )
}
