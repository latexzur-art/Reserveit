'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Star, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { UnreviewedBooking } from '@/hooks/shared/useUnreviewedBookings'
import type { IssueCategory } from '@/backend/admin/building/building.types'

const ISSUE_CATEGORIES: IssueCategory[] = [
  'EQUIPMENT', 'AIRCON', 'LIGHTING', 'CLEANLINESS', 'NETWORK', 'FURNITURE', 'SAFETY', 'OTHER',
]

interface PostBookingReviewModalProps {
  booking: UnreviewedBooking | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted: () => void
}

export function PostBookingReviewModal({ booking, open, onOpenChange, onSubmitted }: PostBookingReviewModalProps) {
  const { toast } = useToast()
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [issueReported, setIssueReported] = useState(false)
  const [issueCategory, setIssueCategory] = useState<IssueCategory | ''>('')
  const [submitting, setSubmitting] = useState(false)

  const effectiveFacilityId = facilityId || booking?.facilities?.[0]?.id || (booking as any)?.booking_facilities?.[0]?.facility_id || ''

  const reset = () => {
    setFacilityId(null)
    setRating(0)
    setComment('')
    setIssueReported(false)
    setIssueCategory('')
  }

  const handleSubmit = async () => {
    if (!booking || !effectiveFacilityId || rating === 0) return
    if (issueReported && !issueCategory) {
      toast({ title: 'Select an issue category', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/facilities/${effectiveFacilityId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          rating,
          comment: comment || undefined,
          issueReported,
          issueCategory: issueReported ? issueCategory : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit review')
      toast({ title: 'Thanks for your feedback!', description: 'Your review has been submitted.' })
      reset()
      onOpenChange(false)
      onSubmitted()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!booking) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight">Rate Your Reservation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {booking.facilities.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Facility</label>
              <Select value={effectiveFacilityId} onValueChange={setFacilityId}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {booking.facilities.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} type="button" onClick={() => setRating(i + 1)}>
                <Star className={`w-8 h-8 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Optional comment — how was the room, equipment, aircon?"
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="rounded-xl"
          />

          <div className="flex items-center gap-2">
            <Checkbox id="issue-toggle" checked={issueReported} onCheckedChange={c => setIssueReported(!!c)} />
            <label htmlFor="issue-toggle" className="text-sm font-medium cursor-pointer">Report an issue?</label>
          </div>

          {issueReported && (
            <Select value={issueCategory} onValueChange={v => setIssueCategory(v as IssueCategory)}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || rating === 0}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
