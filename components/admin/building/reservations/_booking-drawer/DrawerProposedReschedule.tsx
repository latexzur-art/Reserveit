'use client'

import { Calendar, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BuildingBooking } from '@/backend/admin/building/building.types'

interface DrawerProposedRescheduleProps {
  booking: BuildingBooking
  onCancel?: (id: string, action: 'cancel', notes?: string) => Promise<boolean>
}

export function DrawerProposedReschedule({ booking, onCancel }: DrawerProposedRescheduleProps) {
  if (booking.currentStatus === 'awaiting_reschedule') {
    return (
      <div className="p-6 border-t border-border bg-blue-50/60 dark:bg-blue-950/30 space-y-3">
        <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-widest flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Awaiting Reschedule
        </p>
        <div className="bg-blue-100/60 dark:bg-blue-900/30 rounded-xl p-3 border border-blue-200/50 dark:border-blue-700/40 space-y-2">
          <p className="text-xs text-blue-900 dark:text-blue-200 font-medium">
            This booking has been placed in <span className="font-bold">Awaiting Reschedule</span> status. The user can select a new slot or an admin can propose/assign a new schedule.
          </p>
          {(booking as any).rescheduleDeadline && (
            <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-200 pt-1">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Deadline to pick new slot: {new Date((booking as any).rescheduleDeadline).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel(booking.id, 'cancel', 'Cancelled by admin while awaiting reschedule')}
            className="w-full rounded-xl text-xs font-bold h-9 border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <XCircle className="w-3.5 h-3.5 mr-1.5" />
            Cancel Booking
          </Button>
        )}
      </div>
    )
  }

  if (!['pending_user_response', 'pending_faculty_response'].includes(booking.currentStatus) || !booking.pendingReschedule) {
    return null
  }

  return (
    <div className="p-6 border-t border-border bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
      <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-widest flex items-center gap-1.5">
        <Calendar className="w-3 h-3" /> Proposed Reschedule
      </p>
      <div className="bg-blue-100/60 dark:bg-blue-900/30 rounded-xl p-3 border border-blue-200/50 dark:border-blue-700/40 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-200">
          <Calendar className="w-3.5 h-3.5" />
          {booking.pendingReschedule.proposedDate}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-200">
          <Clock className="w-3.5 h-3.5" />
          {booking.pendingReschedule.proposedStartTime} – {booking.pendingReschedule.proposedEndTime}
        </div>
      </div>
    </div>
  )
}
