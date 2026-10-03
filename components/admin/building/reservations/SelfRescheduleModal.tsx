'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  bookingId: string
  bookingReference: string
  currentDate: string
  currentStart: string
  currentEnd: string
}

type ConflictState = 'idle' | 'checking' | 'clear' | 'conflict'

export function SelfRescheduleModal({
  open, onClose, onSuccess,
  bookingId, bookingReference,
  currentDate, currentStart, currentEnd,
}: Props) {
  const [newDate,       setNewDate]       = useState('')
  const [newStart,      setNewStart]      = useState('')
  const [newEnd,        setNewEnd]        = useState('')
  const [conflictState, setConflictState] = useState<ConflictState>('idle')
  const [conflictMsg,   setConflictMsg]   = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [success,       setSuccess]       = useState(false)

  // Touched tracking
  const [touched, setTouched] = useState<Set<string>>(new Set())
  function touch(key: string) { setTouched(prev => new Set([...prev, key])) }

  const today = new Date().toISOString().slice(0, 10)

  const isSunday = newDate ? new Date(`${newDate}T00:00:00`).getDay() === 0 : false
  const dateError  = touched.has('date')
    ? !newDate
      ? 'Date is required.'
      : isSunday
        ? 'Sundays are not available for internal bookings.'
        : undefined
    : undefined
  const startError = touched.has('start') && !newStart ? 'Start time is required.' : undefined
  const endError   = touched.has('end')
    ? !newEnd
      ? 'End time is required.'
      : newEnd <= newStart && newStart
        ? 'End time must be after start time.'
        : undefined
    : undefined

  const isNoOp = newDate === currentDate && newStart === currentStart && newEnd === currentEnd

  // ── Conflict check whenever all three fields are filled ───────────────────
  useEffect(() => {
    if (!newDate || !newStart || !newEnd || newEnd <= newStart) {
      setConflictState('idle')
      return
    }
    if (isNoOp) { setConflictState('idle'); return }

    setConflictState('checking')
    const q = new URLSearchParams({ date: newDate, start_time: newStart, end_time: newEnd })
    fetch(`/api/bookings/${bookingId}/check-reschedule-slot?${q}`)
      .then(r => r.json())
      .then(d => {
        if (d.conflict) {
          setConflictState('conflict')
          setConflictMsg(d.conflicting_booking_reference
            ? `Conflicts with booking ${d.conflicting_booking_reference}.`
            : 'This slot is already taken.')
        } else {
          setConflictState('clear')
          setConflictMsg('')
        }
      })
      .catch(() => setConflictState('idle'))
  }, [newDate, newStart, newEnd, bookingId, isNoOp])

  function reset() {
    setNewDate(''); setNewStart(''); setNewEnd('')
    setConflictState('idle'); setConflictMsg('')
    setSubmitting(false); setError(null); setSuccess(false)
    setTouched(new Set())
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    touch('date'); touch('start'); touch('end')
    if (!newDate || !newStart || !newEnd || newEnd <= newStart) return
    if (conflictState === 'conflict') return
    if (isNoOp) { setError('New schedule is the same as the current one.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res  = await fetch(`/api/bookings/${bookingId}/self-reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: newDate, start_time: newStart, end_time: newEnd }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to reschedule.'); return }
      setSuccess(true)
      onSuccess()
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open ? handleClose : undefined}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
            RESCHEDULE <span className="text-accent-brand">BOOKING</span>
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="font-semibold text-emerald-600">Rescheduled Successfully</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{bookingReference}</span> has been moved to{' '}
              <strong>{newDate}</strong> ({newStart}–{newEnd}).
            </p>
            <Button className="mt-2" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Current schedule */}
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 text-sm space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Schedule</p>
              <p className="font-medium">{currentDate} · {currentStart}–{currentEnd}</p>
            </div>

            {/* New schedule */}
            <div className="space-y-1">
              <Label htmlFor="sr-date">New Date <span className="text-red-500">*</span></Label>
              <Input
                id="sr-date" type="date" min={today}
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                onBlur={() => touch('date')}
                className={cn(dateError && 'border-red-500')}
              />
              {dateError && <p className="text-xs text-red-500">{dateError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sr-start">Start Time <span className="text-red-500">*</span></Label>
                <Input
                  id="sr-start" type="time"
                  value={newStart}
                  onChange={e => { setNewStart(e.target.value); if (touched.has('end')) touch('end') }}
                  onBlur={() => touch('start')}
                  className={cn(startError && 'border-red-500')}
                />
                {startError && <p className="text-xs text-red-500">{startError}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sr-end">End Time <span className="text-red-500">*</span></Label>
                <Input
                  id="sr-end" type="time"
                  value={newEnd}
                  onChange={e => { setNewEnd(e.target.value); if (touched.has('end')) touch('end') }}
                  onBlur={() => touch('end')}
                  className={cn(endError && 'border-red-500')}
                />
                {endError && <p className="text-xs text-red-500">{endError}</p>}
              </div>
            </div>

            {/* Conflict / clear indicator */}
            {conflictState === 'checking' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking availability…
              </div>
            )}
            {conflictState === 'conflict' && (
              <div className="flex items-start gap-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {conflictMsg}
              </div>
            )}
            {conflictState === 'clear' && !isNoOp && (
              <div className="flex items-center gap-2 text-xs text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Time slot is available.
              </div>
            )}
            {isNoOp && newDate && newStart && newEnd && (
              <p className="text-xs text-amber-600">New schedule is the same as the current one — please change at least one field.</p>
            )}

            {error && (
              <p className="text-sm text-red-500 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
              <Button
                type="submit"
                disabled={submitting || conflictState === 'conflict' || conflictState === 'checking' || isNoOp}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Reschedule
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
