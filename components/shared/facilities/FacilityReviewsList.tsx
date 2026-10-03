'use client'

import { Star } from 'lucide-react'
import type { FacilityReview } from '@/backend/admin/building/building.types'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

export function FacilityReviewsList({ reviews, avgRating }: { reviews: FacilityReview[]; avgRating: number | null }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
        Recent User Feedback {avgRating !== null && `(${avgRating.toFixed(1)} / 5.0 — ${reviews.length} reviews)`}
      </p>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {reviews.slice(0, 10).map(r => (
            <div key={r.id} className="text-sm border-b border-border/40 pb-2 last:border-0">
              <div className="flex items-center gap-1 mb-0.5" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} aria-hidden="true" />
                ))}
              </div>
              {r.comment && <p className="text-muted-foreground">&ldquo;{r.comment}&rdquo;</p>}
              <p className="text-xs text-muted-foreground/70 mt-0.5">— {r.userName} ({timeAgo(r.createdAt)})</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
