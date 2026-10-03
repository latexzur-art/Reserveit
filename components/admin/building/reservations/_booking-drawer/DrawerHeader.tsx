'use client'

import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BuildingBooking } from '@/backend/admin/building/building.types'

interface StatusConfig {
  color: string
  icon: React.ReactNode
  label: string
}

interface DrawerHeaderProps {
  booking: BuildingBooking
  status: StatusConfig
}

export function DrawerHeader({ booking, status }: DrawerHeaderProps) {
  return (
    <SheetHeader className="px-6 py-5 border-b border-border bg-muted/30">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#0072bc]">
            Reference #{booking.bookingReference}
          </span>
          <Badge className={cn("text-[10px] font-black uppercase border-none px-2 py-0.5 shadow-none", status.color)}>
            <span className="flex items-center gap-1.5">
              {status.icon}
              {status.label}
            </span>
          </Badge>
        </div>
        <SheetTitle className="text-xl font-black uppercase tracking-tight">
          {booking.eventName || 'Reservation Details'}
        </SheetTitle>
      </div>
    </SheetHeader>
  )
}
