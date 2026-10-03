'use client'

import { Button } from '@/components/ui/button'
import type { BuildingBooking } from '@/backend/admin/building/building.types'

interface DrawerPendingActionsProps {
  booking: BuildingBooking
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
}

export function DrawerPendingActions({ booking, onApprove, onReject }: DrawerPendingActionsProps) {
  if (booking.currentStatus !== 'pending') return null

  return (
    <div className="p-6 border-t border-border bg-muted/20">
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-2xl h-11 font-black uppercase text-[10px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onReject}
        >
          Reject Reservation
        </Button>
        <Button
          className="flex-1 rounded-2xl h-11 font-black uppercase text-[10px] bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
          onClick={onApprove}
        >
          Approve Now
        </Button>
      </div>
    </div>
  )
}
