'use client'

import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import type { DirectoryBooking } from '@/backend/admin/building/building.types'
import { paymentStatusLabel, bookingStatusLabel } from '@/lib/enum-labels'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  auto_approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  auto_declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  completed: 'bg-blue-100 text-blue-700',
  flagged: 'bg-orange-100 text-orange-700',
}

interface Props {
  bookings: DirectoryBooking[]
  loading: boolean
}

export function BookingsTab({ bookings, loading }: Props) {
  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  }

  if (!bookings.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No bookings found.</p>
  }

  return (
    <ScrollArea className="h-72">
      <div className="space-y-2 pr-2">
        {bookings.map(b => (
          <div key={b.id} className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-mono font-bold text-muted-foreground">{b.bookingReference}</p>
              <Badge className={`text-[10px] border-none shrink-0 ${STATUS_COLORS[b.currentStatus] ?? 'bg-muted text-muted-foreground'}`}>
                {bookingStatusLabel(b.currentStatus)}
              </Badge>
            </div>
            <p className="text-sm font-medium truncate">{b.eventName ?? b.purpose}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{new Date(b.bookingDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span>{b.startTime.slice(0, 5)} – {b.endTime.slice(0, 5)}</span>
              {b.facilities.length > 0 && <span>{b.facilities.join(', ')}</span>}
            </div>
            {b.courseCode && (
              <p className="text-xs text-muted-foreground">
                Course: {b.courseCode} — {b.courseName}
                {b.isElective && <span className="ml-1.5 font-medium">(Elective: {b.electiveType})</span>}
              </p>
            )}
            {b.requiresPayment && b.paymentStatus && (
              <Badge variant="outline" className="text-[10px]">
                Payment: {paymentStatusLabel(b.paymentStatus)}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
