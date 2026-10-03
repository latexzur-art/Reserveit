'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Users, Menu, X, HelpCircle, Package, ClipboardList, ArrowLeftRight, Bell } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HelpSheet } from '@/components/help/HelpSheet'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

const EQUIPMENT_NAV = [
  { href: ROUTES.userManager.equipment, label: 'Tech Equipment', icon: Package },
  { href: ROUTES.userManager.equipmentReports, label: 'Tech Reports', icon: ClipboardList },
  { href: ROUTES.userManager.equipmentRequests, label: 'Assign Requests', icon: ArrowLeftRight },
]

function SidebarInner({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const [helpOpen, setHelpOpen] = useState(false)
  const isActive = pathname === ROUTES.userManager.root

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
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-all"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
          Overview
        </p>
        <Link
          href={ROUTES.userManager.root}
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative',
            isActive
              ? 'bg-yellow-50 dark:bg-blue-600/10 text-yellow-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
          )}
        >
          {isActive && (
            <div className="absolute left-0 w-1 h-6 rounded-r-full bg-yellow-500 dark:bg-blue-600" />
          )}
          <Users size={20} className={cn('shrink-0', isActive ? 'text-yellow-500 dark:text-blue-400' : '')} />
          <span className="text-[11px] font-black uppercase tracking-tight">Users Management</span>
        </Link>

        {(() => {
          const notifActive = pathname === ROUTES.userManager.notifications
          return (
            <Link
              href={ROUTES.userManager.notifications}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative',
                notifActive
                  ? 'bg-yellow-50 dark:bg-blue-600/10 text-yellow-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
              )}
            >
              {notifActive && (
                <div className="absolute left-0 w-1 h-6 rounded-r-full bg-yellow-500 dark:bg-blue-600" />
              )}
              <Bell size={20} className={cn('shrink-0', notifActive ? 'text-yellow-500 dark:text-blue-400' : '')} />
              <span className="text-[11px] font-black uppercase tracking-tight">System Notifications</span>
            </Link>
          )
        })()}

        <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 mt-6 opacity-70">
          IT Equipment
        </p>
        {EQUIPMENT_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative',
                active
                  ? 'bg-yellow-50 dark:bg-blue-600/10 text-yellow-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
              )}
            >
              {active && <div className="absolute left-0 w-1 h-6 rounded-r-full bg-yellow-500 dark:bg-blue-600" />}
              <Icon size={20} className={cn('shrink-0', active ? 'text-yellow-500 dark:text-blue-400' : '')} />
              <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-6 pt-4 border-t border-neutral-200 dark:border-white/5">
        <button
          onClick={() => setHelpOpen(true)}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200 transition-all"
        >
          <HelpCircle size={20} className="shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-tight">Help Center</span>
        </button>
      </div>

      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

export function UserManagerSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-[60]">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-10 w-10 shadow-xl bg-white dark:bg-[#15181E] border-neutral-200 dark:border-white/5"
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
