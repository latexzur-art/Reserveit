'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Clock, CheckCircle2, XCircle, MapPin } from 'lucide-react'
import type { BuildingBooking } from '@/backend/admin/building/building.types'
import { cn } from '@/lib/utils'

interface Facility {
  id: string
  name: string
  room_number: string | null
}

interface SubmitData {
  newDate: string
  newStartTime: string
  newEndTime: string
  newFacilityId?: string
  customMessage: string
}

interface Props {
  booking: BuildingBooking | null
  open: boolean
  onClose: () => void
  onSubmit: (data: SubmitData) => Promise<boolean>
  defaultMessage: string
}

/** Strips seconds from HH:MM:SS → HH:MM (safe no-op if already HH:MM) */
function toHHMM(time?: string | null): string {
  if (!time || typeof time !== 'string') return ''
  return time.slice(0, 5)
}

function addMinutesToTime(time: string, minutes: number): string {
  const hhmm = toHHMM(time)
  if (!hhmm || !hhmm.includes(':')) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return ''
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

function durationMinutes(start?: string | null, end?: string | null): number {
  const s = toHHMM(start)
  const e = toHHMM(end)
  if (!s || !e || !s.includes(':') || !e.includes(':')) return 0
  const [sh, sm] = s.split(':').map(Number)
  const [eh, em] = e.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
  return (eh * 60 + em) - (sh * 60 + sm)
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

type SlotStatus = 'idle' | 'checking' | 'available' | 'conflict'

export function EmergencyRescheduleModal({ booking, open, onClose, onSubmit, defaultMessage }: Props) {
  const [newDate, setNewDate] = useState('')
  const [newStartTime, setNewStartTime] = useState('')
  const [newEndTime, setNewEndTime] = useState('')
  const [newFacilityId, setNewFacilityId] = useState('')
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [customMessage, setCustomMessage] = useState('')
  const [messageEdited, setMessageEdited] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [slotStatus, setSlotStatus] = useState<SlotStatus>('idle')
  const [conflictRef, setConflictRef] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bookingStartTime = booking?.startTime ?? (booking as any)?.start_time ?? ''
  const bookingEndTime = booking?.endTime ?? (booking as any)?.end_time ?? ''
  const bookingReference = booking?.bookingReference ?? (booking as any)?.booking_reference ?? 'Booking'
  const facilityName =
    booking?.facilities?.[0]?.name ??
    (booking as any)?.booking_facilities?.[0]?.facilities?.name ??
    (booking as any)?.facilityName ??
    (booking as any)?.facility_name ??
    (booking as any)?.facility?.name ??
    'Facility'
  const bookingDate = booking?.bookingDate ?? (booking as any)?.booking_date ?? ''

  const originalDuration = booking
    ? durationMinutes(bookingStartTime, bookingEndTime)
    : 0

  const isInternal = ((booking?.bookingType ?? (booking as any)?.booking_type) ?? '').toLowerCase().startsWith('internal')

  // Internal-booking constraint violations (only evaluated when isInternal)
  const isSundaySelected = isInternal && !!newDate &&
    new Date(newDate + 'T00:00:00').getDay() === 0

  const startMinutes = newStartTime ? (() => { const [h, m] = newStartTime.split(':').map(Number); return h * 60 + m })() : null
  const endMinutes   = newEndTime   ? (() => { const [h, m] = newEndTime.split(':').map(Number);   return h * 60 + m })() : null
  const isBeforeOpen = isInternal && startMinutes !== null && startMinutes < 7 * 60        // before 07:00
  const isAfterClose = isInternal && endMinutes   !== null && endMinutes   > 19 * 60       // after 19:00

  const hasConstraintError = isSundaySelected || isBeforeOpen || isAfterClose

  // Reset all fields when the target booking changes
  useEffect(() => {
    if (booking) {
      const start = booking.startTime ?? (booking as any).start_time ?? ''
      const end = booking.endTime ?? (booking as any).end_time ?? ''
      const dur = durationMinutes(start, end)

      setNewDate(getTomorrow())
      setNewStartTime(toHHMM(start))
      setNewEndTime(addMinutesToTime(start, dur))
      setNewFacilityId('')
      setCustomMessage(defaultMessage)
      setMessageEdited(false)
      setSlotStatus('idle')
      setConflictRef(null)
    }
  }, [booking?.id]) // intentionally excludes defaultMessage — see below

  // Fetch active facilities once on mount
  useEffect(() => {
    fetch('/api/admin/building/facilities?status=available&pageSize=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => setFacilities((d?.facilities ?? []).map((f: any) => ({ id: f.id, name: f.name, room_number: f.roomNumber ?? null }))))
      .catch(() => {})
  }, [])

  // Apply the template only when it arrives and the admin hasn't typed anything yet
  useEffect(() => {
    if (defaultMessage && !messageEdited) {
      setCustomMessage(defaultMessage)
    }
  }, [defaultMessage])

  // Update end time whenever start time changes
  useEffect(() => {
    if (newStartTime && originalDuration > 0) {
      setNewEndTime(addMinutesToTime(newStartTime, originalDuration))
    }
  }, [newStartTime, originalDuration])

  // Debounced slot conflict check whenever date or start time changes
  useEffect(() => {
    if (!booking || !newDate || !newStartTime || !newEndTime) {
      setSlotStatus('idle')
      return
    }

    setSlotStatus('checking')
    setConflictRef(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          date: newDate,
          start_time: toHHMM(newStartTime),
          end_time: toHHMM(newEndTime),
          ...(newFacilityId ? { facility_id: newFacilityId } : {}),
        })
        const res = await fetch(
          `/api/admin/building/bookings/${booking.id}/check-reschedule-slot?${params}`
        )
        if (!res.ok) { setSlotStatus('idle'); return }
        const data = await res.json()
        if (data.conflict) {
          setSlotStatus('conflict')
          setConflictRef(data.conflicting_booking_reference ?? null)
        } else {
          setSlotStatus('available')
          setConflictRef(null)
        }
      } catch {
        setSlotStatus('idle')
      }
    }, 600)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [newDate, newStartTime, newEndTime, newFacilityId, booking?.id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newDate || !newStartTime || !newEndTime || slotStatus === 'conflict') return
    setSubmitting(true)
    try {
      const ok = await onSubmit({
        newDate,
        newStartTime: toHHMM(newStartTime),
        newEndTime: toHHMM(newEndTime),
        newFacilityId: newFacilityId || undefined,
        customMessage,
      })
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  if (!booking) return null

  const isBlocked = slotStatus === 'conflict'
  const isChecking = slotStatus === 'checking'

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-black uppercase tracking-tight text-foreground">
                EMERGENCY <span className="text-accent-brand">RESCHEDULE</span>
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                {bookingReference} · {facilityName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Original schedule info */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Original Schedule</p>
            <div className="flex items-center gap-2 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              {bookingDate} · {toHHMM(bookingStartTime)} – {toHHMM(bookingEndTime)}
              <span className="ml-auto text-xs font-semibold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-full">
                {formatDuration(originalDuration)}
              </span>
            </div>
          </div>

          {/* New date */}
          <div className="space-y-1.5">
            <label htmlFor="reschedule-new-date" className="text-xs font-semibold text-foreground">
              New Date <span className="text-red-500">*</span>
            </label>
            <input
              id="reschedule-new-date"
              type="date"
              required
              min={getTomorrow()}
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className={cn(
                "w-full h-10 px-3 rounded-lg border bg-background text-sm font-medium focus:outline-none focus:ring-2 transition-colors",
                isSundaySelected
                  ? "border-red-500 focus:ring-red-500/30 bg-red-50/40 dark:bg-red-950/20"
                  : "border-border focus:ring-ring/30"
              )}
            />
            {isSundaySelected && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                Sundays are not available for internal bookings.
              </p>
            )}
          </div>

          {/* New start time */}
          <div className="space-y-1.5">
            <label htmlFor="reschedule-new-start" className="text-xs font-semibold text-foreground">
              New Start Time <span className="text-red-500">*</span>
            </label>
            <input
              id="reschedule-new-start"
              type="time"
              required
              value={newStartTime}
              onChange={e => setNewStartTime(e.target.value)}
              className={cn(
                "w-full h-10 px-3 rounded-lg border bg-background text-sm font-medium focus:outline-none focus:ring-2 transition-colors",
                isBlocked || isBeforeOpen || isAfterClose
                  ? "border-red-500 focus:ring-red-500/30 bg-red-50/40 dark:bg-red-950/20"
                  : slotStatus === 'available'
                    ? "border-emerald-500 focus:ring-emerald-500/30"
                    : "border-border focus:ring-ring/30"
              )}
            />
            {(isBeforeOpen || isAfterClose) && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                Internal bookings must be scheduled between 7:00 AM and 7:00 PM.
              </p>
            )}
          </div>

          {/* Auto-computed end time */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              New End Time (Auto-computed)
            </label>
            <div className={cn(
              "h-10 px-3 rounded-lg border flex items-center justify-between transition-colors",
              isBlocked
                ? "border-red-500/40 bg-red-50/30 dark:bg-red-950/10"
                : "border-border/40 bg-muted/30"
            )}>
              <span className="text-sm font-bold text-foreground">{newEndTime || '—'}</span>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Same duration · {formatDuration(originalDuration)}
              </span>
            </div>
          </div>

          {/* New room (optional) */}
          <div className="space-y-1.5">
            <label htmlFor="reschedule-new-room" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3 h-3" aria-hidden="true" /> New Room <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              id="reschedule-new-room"
              value={newFacilityId}
              onChange={e => setNewFacilityId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/30 appearance-none"
            >
              <option value="">Keep current room</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Slot availability status banner */}
          {slotStatus !== 'idle' && (
            <div className={cn(
              "rounded-lg px-4 py-3 flex items-start gap-3 text-xs font-bold transition-all",
              slotStatus === 'checking' && "bg-muted/50 border border-border/40 text-muted-foreground",
              slotStatus === 'available' && "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
              slotStatus === 'conflict' && "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400",
            )}>
              {slotStatus === 'checking' && (
                <><Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>Checking slot availability...</span></>
              )}
              {slotStatus === 'available' && (
                <><CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" aria-label="Available" />
                <span>Slot is available — no conflicts detected.</span></>
              )}
              {slotStatus === 'conflict' && (
                <><XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-label="Conflict" />
                <div>
                  <p>This time slot conflicts with an existing booking{conflictRef ? ` (${conflictRef})` : ''}.</p>
                  <p className="text-xs font-medium mt-0.5 opacity-80">Please choose a different date or start time.</p>
                </div></>
              )}
            </div>
          )}

          {/* Custom message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="reschedule-message" className="text-xs font-semibold text-foreground">
                Message to User
              </label>
              <span className="text-xs text-muted-foreground">{customMessage.length}/2000</span>
            </div>
            <textarea
              id="reschedule-message"
              rows={4}
              maxLength={2000}
              value={customMessage}
              onChange={e => { setCustomMessage(e.target.value); setMessageEdited(true) }}
              placeholder="Explain the reason for the emergency reschedule..."
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-ring/30 leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-lg h-11 font-bold uppercase text-xs tracking-wide"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !newDate || !newStartTime || isBlocked || isChecking || hasConstraintError}
              className={cn(
                "flex-1 rounded-lg h-11 font-bold uppercase text-xs tracking-wide text-white transition-all",
                isBlocked || hasConstraintError
                  ? "bg-red-500/50 cursor-not-allowed opacity-60"
                  : "bg-amber-600 hover:bg-amber-700"
              )}
            >
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" aria-hidden="true" /> Sending...</>
              ) : isChecking ? (
                <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" aria-hidden="true" /> Checking...</>
              ) : isBlocked ? (
                <><XCircle className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> Slot Unavailable</>
              ) : hasConstraintError ? (
                <><XCircle className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> Invalid Schedule</>
              ) : (
                <><AlertTriangle className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> Send Proposal</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
