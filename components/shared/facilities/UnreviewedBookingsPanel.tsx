'use client'

import { useState } from 'react'
import { Star, CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUnreviewedBookings, type UnreviewedBooking } from '@/hooks/shared/useUnreviewedBookings'
import { PostBookingReviewModal } from './PostBookingReviewModal'

/**
 * Additive "awaiting your review" list — doesn't touch each role's existing
 * (and intricate) reservation-card rendering logic. Mount at the top of a
 * My Reservations / My Bookings page.
 */
export function UnreviewedBookingsPanel() {
  const { bookings, loading, refetch } = useUnreviewedBookings()
  const [reviewing, setReviewing] = useState<UnreviewedBooking | null>(null)

  if (loading || bookings.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
      <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
        {bookings.length} completed reservation{bookings.length > 1 ? 's' : ''} awaiting your review
      </p>
      <div className="space-y-2">
        {bookings.map(b => (
          <div key={b.id} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {b.facilities.map(f => f.name).join(', ') || 'Facility'}
              </p>
              <p className="text-xs text-muted-foreground">{b.bookingDate} · {b.eventName || b.purpose}</p>
            </div>
            <Button size="sm" onClick={() => setReviewing(b)}>Rate & Review</Button>
          </div>
        ))}
      </div>

      <PostBookingReviewModal
        booking={reviewing}
        open={!!reviewing}
        onOpenChange={open => !open && setReviewing(null)}
        onSubmitted={refetch}
      />
    </div>
  )
}
