'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Clock, Loader2, AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react'
import type { BuildingBooking } from '@/backend/admin/building/building.types'
import { cn } from '@/lib/utils'

interface Props {
  booking: BuildingBooking | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

/** Strips seconds from HH:MM:SS → HH:MM */
function toHHMM(time?: string | null): string {
  if (!time || typeof time !== 'string') return ''
  return time.slice(0, 5)
}

/** Generate time options in 30-min increments from start to 21:00 */
function generateTimeOptions(startHHMM: string): string[] {
  const [sh, sm] = startHHMM.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = 21 * 60 // 21:00
  const options: string[] = []
  for (let m = startMin + 30; m <= endMin; m += 30) {
    const h = Math.floor(m / 60)
    const min = m % 60
    options.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return options
}

export function AdminExtendDialog({ booking, open, onClose, onSuccess }: Props) {
  const [newEndTime, setNewEndTime] = useState('')
  const [recordPayment, setRecordPayment] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [costPreview, setCostPreview] = useState<number | null>(null)
  const [loadingCost, setLoadingCost] = useState(false)

  const currentEnd = toHHMM(booking?.endTime ?? (booking as any)?.end_time)
  const currentStart = toHHMM(booking?.startTime ?? (booking as any)?.start_time)
  const bookingRef = booking?.bookingReference ?? (booking as any)?.booking_reference ?? 'Booking'
  const facilityName =
    booking?.facilities?.[0]?.name ??
    (booking as any)?.booking_facilities?.[0]?.facilities?.name ??
    'Gymnasium'

  // Reset state when booking changes
  useEffect(() => {
    if (booking && open) {
      setNewEndTime('')
      setRecordPayment(true)
      setError(null)
      setSuccess(false)
      setCostPreview(null)
    }
  }, [booking?.id, open])

  // Fetch cost preview when newEndTime changes
  useEffect(() => {
    if (!booking || !newEndTime || !currentEnd || newEndTime <= currentEnd) {
      setCostPreview(null)
      return
    }

    setLoadingCost(true)
    const controller = new AbortController()

    fetch('/api/admin/building/bookings/' + booking.id + '/payment-total', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: currentEnd,
        end_time: newEndTime,
      }),
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.amount != null) setCostPreview(data.amount)
      })
      .catch(() => {})
      .finally(() => setLoadingCost(false))

    return () => controller.abort()
  }, [booking?.id, newEndTime, currentEnd])

  const handleSubmit = useCallback(async () => {
    if (!booking || !newEndTime) return
    if (newEndTime <= currentEnd) {
      setError('New end time must be after the current end time.')
      return
    }
    if (newEndTime > '21:00') {
      setError('End time cannot exceed 9:00 PM.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/building/bookings/${booking.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_end_time: newEndTime,
          record_payment: recordPayment,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to extend booking.')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [booking, newEndTime, recordPayment, currentEnd, onSuccess, onClose])

  const timeOptions = currentEnd ? generateTimeOptions(currentEnd) : []

  // Calculate extension duration for display
  const extensionMinutes = newEndTime && currentEnd
    ? (() => {
        const [sh, sm] = currentEnd.split(':').map(Number)
        const [eh, em] = newEndTime.split(':').map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      })()
    : 0

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-brand" />
            Extend Booking
          </DialogTitle>
          <DialogDescription>
            Extend <span className="font-semibold">{bookingRef}</span> at {facilityName}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Booking extended successfully!
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Current End Time */}
            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current End Time</span>
              <span className="text-sm font-bold tabular-nums">{currentEnd || '—'}</span>
            </div>

            {/* New End Time Picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">New End Time</Label>
              <select
                value={newEndTime}
                onChange={e => { setNewEndTime(e.target.value); setError(null) }}
                className={cn(
                  'w-full h-11 rounded-xl border bg-background px-3 text-sm font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-accent-brand/30 focus:border-accent-brand',
                  'dark:border-border dark:bg-muted',
                  !newEndTime && 'text-muted-foreground'
                )}
              >
                <option value="">Select new end time...</option>
                {timeOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {newEndTime && extensionMinutes > 0 && (
                <p className="text-xs text-muted-foreground">
                  Extension: <span className="font-semibold text-foreground">{formatDuration(extensionMinutes)}</span> additional
                </p>
              )}
            </div>

            {/* Cost Preview */}
            {newEndTime && newEndTime > currentEnd && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 p-3">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Extension Cost
                </span>
                {loadingCost ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                ) : (
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {costPreview != null ? `₱${(costPreview / 100).toFixed(2)}` : '—'}
                  </span>
                )}
              </div>
            )}

            {/* Record Payment Toggle */}
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Record Cash Payment</Label>
                <p className="text-[11px] text-muted-foreground">
                  Mark extension as paid via cashier
                </p>
              </div>
              <Switch
                checked={recordPayment}
                onCheckedChange={setRecordPayment}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl text-xs font-bold h-9"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newEndTime || newEndTime <= currentEnd || submitting}
              className="rounded-xl text-xs font-bold h-9 bg-accent-brand hover:bg-accent-brand/90 text-white"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Extending...
                </span>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Extend Booking
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
