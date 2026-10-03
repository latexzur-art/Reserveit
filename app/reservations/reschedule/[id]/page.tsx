'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useUI } from '@/contexts/UIContext'
import { useAuth } from '@/contexts/AuthContext'
import { getBookingsUrlForRoles } from '@/lib/routes'
import {
  Loader2, CalendarDays, Clock, Building2, AlertTriangle, CheckCircle, ArrowLeft, Undo2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface OfferDetails {
  id: string
  booking_reference: string
  original_date: string
  original_start: string
  original_end: string
  duration_minutes: number
  session_type: string | null
  deadline: string | null
  displaced_by: string | null
  original_facility: { id: string; name: string; room_number: string } | null
  has_completed_payment: boolean
  payment_amount: number | null
  payment_id: string | null
}

interface Facility {
  id: string
  name: string
  room_number: string | null
  facility_purpose_category: string | null
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return null
  const d = new Date(deadline)
  return d.toLocaleString()
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export default function RescheduleOfferPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { textSizeEnlarged } = useUI()
  const { user } = useAuth()
  const bookingsUrl = getBookingsUrlForRoles(user?.roles ?? [])

  const [offer, setOffer] = useState<OfferDetails | null>(null)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loadingOffer, setLoadingOffer] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [newDate, setNewDate] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newFacilityId, setNewFacilityId] = useState('')

  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundSuccess, setRefundSuccess] = useState(false)
  const [refundDestName, setRefundDestName] = useState('')
  const [refundDestContact, setRefundDestContact] = useState('')

  useEffect(() => {
    async function load() {
      setLoadingOffer(true)
      try {
        const res = await fetch(`/api/bookings/${id}/reschedule-offer`)
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? 'Could not load offer.')
          return
        }
        setOffer(data)
        // Pre-fill times with original duration
        setNewStart(data.original_start)
        const endM = data.original_start.split(':').map(Number).reduce((a: number, b: number, i: number) => a + (i === 0 ? b * 60 : b), 0) + data.duration_minutes
        const eh = Math.floor(endM / 60).toString().padStart(2, '0')
        const em = (endM % 60).toString().padStart(2, '0')
        setNewEnd(`${eh}:${em}`)
        if (data.original_facility) setNewFacilityId(data.original_facility.id)
      } catch {
        toast.error('Failed to load reschedule offer.')
      } finally {
        setLoadingOffer(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    fetch('/api/facilities?limit=200')
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setFacilities(Array.isArray(d) ? d : (d.facilities ?? [])))
      .catch(() => {})
  }, [])

  // Auto-update end time when start time changes (preserve duration)
  useEffect(() => {
    if (!offer || !newStart) return
    const [h, m] = newStart.split(':').map(Number)
    const startMinutes = h * 60 + m
    const endMinutes = startMinutes + offer.duration_minutes
    const eh = Math.floor(endMinutes / 60).toString().padStart(2, '0')
    const em = (endMinutes % 60).toString().padStart(2, '0')
    setNewEnd(`${eh}:${em}`)
  }, [newStart, offer])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate || !newStart || !newEnd || !newFacilityId) {
      toast.error('Please fill in all fields.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${id}/reschedule-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: newDate,
          start_time: newStart,
          end_time: newEnd,
          facility_id: newFacilityId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reschedule.')
      setSuccess(true)
      toast.success('Booking rescheduled and instantly approved!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRefundRequest() {
    setRefundSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${id}/displaced-refund-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(offer?.has_completed_payment && {
            refund_destination_name: refundDestName,
            refund_destination_contact_number: refundDestContact,
          }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to process request.')
      setRefundSuccess(true)
      setShowRefundDialog(false)
      toast.success(offer?.has_completed_payment ? 'Refund requested!' : 'Booking cancelled.')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRefundSubmitting(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  if (loadingOffer) {
    return (
      <div className={cn("min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8", textSizeEnlarged && "text-enlarged")}>
        <div className="max-w-lg mx-auto">
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-md mb-6 animate-pulse" />
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 animate-pulse">
            <div className="h-6 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-md mb-2" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-md mb-5" />
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-5 space-y-3">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-md" />
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded-md" />
            </div>
            <div className="space-y-4">
              <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!offer) {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-screen gap-4 text-muted-foreground", textSizeEnlarged && "text-enlarged")}>
        <AlertTriangle className="w-10 h-10" />
        <p>Reschedule offer not found or no longer available.</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  if (success) {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-screen gap-4", textSizeEnlarged && "text-enlarged")}>
        <CheckCircle className="w-14 h-14 text-emerald-500" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Rescheduled!</h2>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          Your booking has been moved to {newDate} ({newStart}–{newEnd}) and instantly approved.
          Check your email for confirmation.
        </p>
        <Button onClick={() => router.push(bookingsUrl)}>View My Reservations</Button>
      </div>
    )
  }

  if (refundSuccess) {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-screen gap-4", textSizeEnlarged && "text-enlarged")}>
        <CheckCircle className="w-14 h-14 text-emerald-500" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          {offer?.has_completed_payment ? 'Refund Requested' : 'Booking Cancelled'}
        </h2>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          {offer?.has_completed_payment
            ? `Your booking has been cancelled. A refund of ₱${Number(offer.payment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} will be processed by the building admin.`
            : 'Your booking has been cancelled.'}
        </p>
        <Button onClick={() => router.push(bookingsUrl)}>View My Reservations</Button>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8", textSizeEnlarged && "text-enlarged")}>
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
          <h1 className="text-xl font-black text-slate-800 dark:text-white mb-1">Reschedule Your Booking</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Your original slot was displaced by a school event. Pick a new date and room.
          </p>

          {/* Original details */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-5 space-y-2 text-sm">
            <p className="text-xs font-bold text-muted-foreground mb-1">Original Booking</p>
            <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <CalendarDays className="w-4 h-4 flex-shrink-0" />
              {offer.original_date}
            </p>
            <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Clock className="w-4 h-4 flex-shrink-0" />
              {offer.original_start} – {offer.original_end} ({formatDuration(offer.duration_minutes)})
            </p>
            {offer.original_facility && (
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Building2 className="w-4 h-4 flex-shrink-0" />
                {offer.original_facility.name}
                {offer.original_facility.room_number && ` (${offer.original_facility.room_number})`}
              </p>
            )}
            {offer.displaced_by && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Displaced by: {offer.displaced_by}
              </p>
            )}
          </div>

          {/* Deadline badge */}
          {offer.deadline && (
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                Respond by {deadlineLabel(offer.deadline)} or the booking will be cancelled.
              </p>
            </div>
          )}

          {offer.session_type && (
            <div className="mb-5">
              <Badge className={cn(
                'text-xs',
                offer.session_type === 'lab'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              )}>
                {offer.session_type === 'lab' ? 'Lab Session — choose a lab room' : 'Lecture Session — choose a lecture room'}
              </Badge>
            </div>
          )}

          {/* Refund option */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mb-5">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Don't want to reschedule?{' '}
              {offer.has_completed_payment
                ? 'You can request a refund for your paid booking.'
                : 'You can cancel this booking instead.'}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
              onClick={() => setShowRefundDialog(true)}
            >
              <Undo2 className="w-4 h-4 mr-2" />
              {offer.has_completed_payment ? 'Request Refund Instead' : 'Cancel Booking'}
            </Button>
          </div>

          {/* New slot form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="date">New Date <span className="text-red-600 dark:text-red-400">*</span></Label>
              <Input
                id="date"
                type="date"
                min={today}
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">Start Time <span className="text-red-600 dark:text-red-400">*</span></Label>
                <Input
                  id="start"
                  type="time"
                  value={newStart}
                  onChange={e => setNewStart(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end">End Time</Label>
                <Input
                  id="end"
                  type="time"
                  value={newEnd}
                  readOnly
                  className="mt-1 bg-slate-50 dark:bg-slate-800 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-0.5">Fixed at {formatDuration(offer.duration_minutes)}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="facility">Room / Facility <span className="text-red-600 dark:text-red-400">*</span></Label>
              <select
                id="facility"
                value={newFacilityId}
                onChange={e => setNewFacilityId(e.target.value)}
                required
                className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              >
                <option value="">Select a room…</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.room_number ? ` (${f.room_number})` : ''}{f.facility_purpose_category ? ` — ${f.facility_purpose_category}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a room suitable for your session type. Incompatible rooms will be rejected.
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting || !newDate || !newFacilityId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm New Schedule
            </Button>
          </form>
        </div>
      </div>

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent className="rounded-xl max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
              <div className="p-2 bg-rose-500/10 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              {offer?.has_completed_payment ? 'Request Refund' : 'Cancel Booking'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
              {offer?.has_completed_payment ? (
                <>
                  Your booking <strong>{offer.booking_reference}</strong> will be cancelled
                  and a refund of <strong>₱{Number(offer.payment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> will
                  be processed by the building admin.
                </>
              ) : (
                <>
                  Your booking <strong>{offer?.booking_reference}</strong> will be cancelled.
                  No payment was made, so no refund is needed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {offer?.has_completed_payment && (
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="refund-name">Account Name <span className="text-rose-500">*</span></Label>
                <Input
                  id="refund-name"
                  placeholder="e.g. Juan Dela Cruz"
                  value={refundDestName}
                  onChange={e => setRefundDestName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="refund-contact">GCash / Phone Number <span className="text-rose-500">*</span></Label>
                <Input
                  id="refund-contact"
                  placeholder="e.g. 09171234567"
                  value={refundDestContact}
                  onChange={e => setRefundDestContact(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter className="mt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-10 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-800 m-0">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider m-0"
              disabled={refundSubmitting || (offer?.has_completed_payment && (!refundDestName || !refundDestContact))}
              onClick={(e) => { e.preventDefault(); handleRefundRequest() }}
            >
              {refundSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm {offer?.has_completed_payment ? 'Refund Request' : 'Cancellation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
