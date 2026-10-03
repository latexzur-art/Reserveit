'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, X } from 'lucide-react'
import { useUnreviewedBookings } from '@/hooks/shared/useUnreviewedBookings'

/** Dismissible per-session nudge; links to the role's reservations page to act. */
export function DashboardReviewBanner({ reservationsPath }: { reservationsPath: string }) {
  const { bookings, loading } = useUnreviewedBookings()
  const [dismissed, setDismissed] = useState(false)

  if (loading || dismissed || bookings.length === 0) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
        <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
        You have {bookings.length} completed reservation{bookings.length > 1 ? 's' : ''} awaiting your review.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Link href={reservationsPath} className="text-xs font-bold text-amber-800 dark:text-amber-300 underline">
          Review Now
        </Link>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X className="w-4 h-4 text-amber-700 dark:text-amber-400" />
        </button>
      </div>
    </div>
  )
}
