'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Loader2, X, Paperclip, CheckCircle2, XCircle, Clock, Phone, Mail, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimePicker } from '@/components/ui/time-picker'
import { cn } from '@/lib/utils'
import { isRefundWindowMet, getManilaDateString } from '@/lib/refund-eligibility'

interface Props {
  bookingId: string
  bookingRef: string
  facilityName: string
  bookingDate: string   // original YYYY-MM-DD
  startTime: string     // original HH:MM
  endTime: string       // original HH:MM
  helpdeskPhone?: string
  helpdeskEmail?: string
  onSubmit: (data: {
    reason: string
    attachmentUrl?: string
    proposedDate: string
    proposedStartTime: string
    proposedEndTime: string
  }) => Promise<boolean>
  onClose: () => void
}

type SlotStatus = 'idle' | 'checking' | 'available' | 'conflict'

function getTomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function RequestRescheduleModal({
  bookingId,
  bookingRef,
  facilityName,
  bookingDate,
  startTime,
  endTime,
  helpdeskPhone,
  helpdeskEmail,
  onSubmit,
  onClose,
}: Props) {
  const [reason, setReason] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [proposedDate, setProposedDate] = useState(getTomorrowDate())
  const [proposedStart, setProposedStart] = useState(startTime)
  const [proposedEnd, setProposedEnd] = useState(endTime)
  const [submitting, setSubmitting] = useState(false)
  const [slotStatus, setSlotStatus] = useState<SlotStatus>('idle')
  const [conflictRef, setConflictRef] = useState<string | null>(null)
  const [extraAmountCentavos, setExtraAmountCentavos] = useState(0)
  const [extraAmountPeso, setExtraAmountPeso] = useState('0.00')
  const [loadingEstimate, setLoadingEstimate] = useState(false)

  const conflictDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const estimateDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Debounced conflict check
  useEffect(() => {
    if (!proposedDate || !proposedStart || !proposedEnd) return
    if (proposedEnd <= proposedStart) return

    if (conflictDebounce.current) clearTimeout(conflictDebounce.current)
    setSlotStatus('checking')
    conflictDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/bookings/${bookingId}/check-reschedule-slot?date=${proposedDate}&start_time=${proposedStart}&end_time=${proposedEnd}`
        )
        if (!res.ok) { setSlotStatus('idle'); return }
        const data = await res.json()
        setSlotStatus(data.conflict ? 'conflict' : 'available')
        setConflictRef(data.conflict ? (data.conflicting_booking_reference ?? null) : null)
      } catch {
        setSlotStatus('idle')
      }
    }, 600)
    return () => { if (conflictDebounce.current) clearTimeout(conflictDebounce.current) }
  }, [bookingId, proposedDate, proposedStart, proposedEnd])

  // Debounced extra charge estimate
  useEffect(() => {
    if (!proposedStart || !proposedEnd || proposedEnd <= proposedStart) {
      setExtraAmountCentavos(0)
      setExtraAmountPeso('0.00')
      return
    }

    if (estimateDebounce.current) clearTimeout(estimateDebounce.current)
    setLoadingEstimate(true)
    estimateDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/bookings/${bookingId}/reschedule-extra-estimate?proposed_start_time=${proposedStart}&proposed_end_time=${proposedEnd}`
        )
        if (!res.ok) { setLoadingEstimate(false); return }
        const data = await res.json()
        setExtraAmountCentavos(data.extraAmountCentavos ?? 0)
        setExtraAmountPeso(data.extraAmountPeso ?? '0.00')
      } catch {
        setExtraAmountCentavos(0)
      } finally {
        setLoadingEstimate(false)
      }
    }, 800)
    return () => { if (estimateDebounce.current) clearTimeout(estimateDebounce.current) }
  }, [bookingId, proposedStart, proposedEnd])

  const timeError = proposedEnd && proposedStart && proposedEnd <= proposedStart
    ? 'End time must be after start time'
    : null
  const dateError = proposedDate && proposedDate <= today
    ? 'Proposed date must be in the future'
    : null

  const withinCutoff = !isRefundWindowMet(bookingDate, getManilaDateString())

  const canSubmit =
    !withinCutoff &&
    reason.trim().length >= 10 &&
    !!proposedDate && !dateError &&
    !!proposedStart && !!proposedEnd && !timeError &&
    slotStatus !== 'conflict' && slotStatus !== 'checking' &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const ok = await onSubmit({
      reason: reason.trim(),
      attachmentUrl: attachmentUrl.trim() || undefined,
      proposedDate,
      proposedStartTime: proposedStart,
      proposedEndTime: proposedEnd,
    })
    if (ok) onClose()
    else setSubmitting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        role="dialog"
        aria-labelledby="emergency-reschedule-modal-title"
        className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
            </div>
            <div>
              <h2 id="emergency-reschedule-modal-title" className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                REQUEST <span className="text-accent-brand">RESCHEDULE</span>
              </h2>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                {bookingRef} · {facilityName}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* 2-day cutoff check */}
          {withinCutoff ? (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
                  <p className="text-xs font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                    Reschedule Not Available
                  </p>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  Reschedule requests must be made at least 2 days before the booking date. Since your booking is within this window, please contact our Helpdesk directly for assistance.
                </p>
              </div>
              {(helpdeskPhone || helpdeskEmail) && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Helpdesk Contact</p>
                  {helpdeskPhone && (
                    <div className="flex items-center gap-2 bg-background/80 dark:bg-black/20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Phone className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wider">{helpdeskPhone}</span>
                    </div>
                  )}
                  {helpdeskEmail && (
                    <div className="flex items-center gap-2 bg-background/80 dark:bg-black/20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Mail className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wider">{helpdeskEmail}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
          <>
          {/* Current schedule banner */}
          <div className="bg-slate-50 dark:bg-slate-900/80 rounded-lg p-4 border border-slate-200 dark:border-slate-800 text-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Current Schedule</p>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              {bookingDate} · {startTime}–{endTime}
            </div>
          </div>

          {/* Integrated Policy & Helpdesk Callout Box */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              Reschedule Policy Notice
            </span>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Your request will be reviewed by a building admin. If approved and your proposed time is longer than your current booking, an <strong>extra charge</strong> will apply before confirmation.
            </p>

            {(helpdeskPhone || helpdeskEmail) && (
              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Helpdesk Contact:</span>
                {helpdeskPhone && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    📞 {helpdeskPhone}
                  </span>
                )}
                {helpdeskEmail && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    ✉ {helpdeskEmail}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Proposed Date */}
          <div className="space-y-1.5">
            <label htmlFor="proposed-date" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Proposed Date <span className="text-red-500">*</span>
            </label>
            <div className={cn(
              'flex items-center rounded-lg border px-3 py-1 bg-white dark:bg-slate-900 focus-within:ring-2 transition-all',
              dateError
                ? 'border-red-300 dark:border-red-500 focus-within:ring-red-200'
                : 'border-slate-200 dark:border-slate-800 focus-within:ring-ring/30'
            )}>
              <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" aria-hidden="true" />
              <input
                id="proposed-date"
                type="date"
                value={proposedDate}
                min={getTomorrowDate()}
                onChange={e => setProposedDate(e.target.value)}
                className="w-full bg-transparent py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            {dateError && <p className="text-xs text-red-400 font-medium">{dateError}</p>}
          </div>

          {/* Proposed Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="proposed-start" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Start Time <span className="text-red-500">*</span>
              </label>
              <TimePicker
                id="proposed-start"
                ariaLabel="Proposed start time"
                value={proposedStart}
                onChange={setProposedStart}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="proposed-end" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                End Time <span className="text-red-500">*</span>
              </label>
              <TimePicker
                id="proposed-end"
                ariaLabel="Proposed end time"
                value={proposedEnd}
                onChange={setProposedEnd}
              />
            </div>
          </div>
          {timeError && <p className="text-xs text-red-400 font-medium">{timeError}</p>}

          {/* Slot availability indicator */}
          {!timeError && proposedStart && proposedEnd && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-3 text-xs font-bold border',
              slotStatus === 'checking' && 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500',
              slotStatus === 'available' && 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
              slotStatus === 'conflict' && 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400',
              slotStatus === 'idle' && 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500',
            )}>
              {slotStatus === 'checking' && <><Clock className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" /> Checking availability…</>}
              {slotStatus === 'available' && <><CheckCircle2 className="w-3.5 h-3.5" aria-label="Available" /> Time slot is available</>}
              {slotStatus === 'conflict' && <><XCircle className="w-3.5 h-3.5" aria-label="Conflict" /> Slot conflicts with booking {conflictRef ?? '(unknown)'}</>}
              {slotStatus === 'idle' && <><Clock className="w-3.5 h-3.5" aria-hidden="true" /> Enter a time to check availability</>}
            </div>
          )}

          {/* Extra charge estimate */}
          {!timeError && proposedStart && proposedEnd && (
            <div className={cn(
              'rounded-lg px-4 py-3 border text-xs',
              extraAmountCentavos > 0
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
            )}>
              {loadingEstimate ? (
                <span className="text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Calculating charge...</span>
              ) : extraAmountCentavos > 0 ? (
                <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong className="font-bold">Extra Charge: ₱{extraAmountPeso}</strong><br />
                  Your proposed time is longer than original. If approved, you will pay this extra charge via PayMongo before confirmation.
                </p>
              ) : (
                <p className="text-emerald-700 dark:text-emerald-300 font-bold">No extra charge — same or shorter duration</p>
              )}
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="reschedule-reason"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Reason for Reschedule <span className="text-red-500">*</span>
              </label>
              <span className={cn(
                'text-xs font-medium transition-colors',
                reason.trim().length === 0
                  ? 'text-slate-400 dark:text-slate-500'
                  : reason.trim().length < 10
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              )}>
                {reason.trim().length} / 10 min characters
              </span>
            </div>
            <textarea
              id="reschedule-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Please describe the reason for your emergency reschedule request..."
              className={cn(
                'w-full resize-none rounded-lg border px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all',
                reason.trim().length > 0 && reason.trim().length < 10
                  ? 'border-amber-300 dark:border-amber-500 focus:ring-amber-200 dark:focus:ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 focus:ring-ring/30'
              )}
            />
          </div>

          {/* Optional Attachment URL */}
          <div className="space-y-1.5">
            <label 
              htmlFor="reschedule-attachment"
              className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
            >
              <Paperclip className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Supporting Document URL <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="reschedule-attachment"
              type="url"
              value={attachmentUrl}
              onChange={e => setAttachmentUrl(e.target.value)}
              placeholder="https://drive.google.com/... (e.g. supporting document)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
            />
          </div>
          </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 pb-6 pt-3 flex flex-col shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 relative z-10">
          {!canSubmit && !withinCutoff && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center mb-2 px-1">
              {reason.trim().length < 10
                ? '• Reason must be at least 10 characters long'
                : dateError
                ? `• ${dateError}`
                : timeError
                ? `• ${timeError}`
                : slotStatus === 'conflict'
                ? '• Proposed slot conflicts with an existing booking'
                : slotStatus === 'checking'
                ? '• Checking time slot availability...'
                : '• Please complete all required fields'}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-lg text-xs font-bold uppercase tracking-wider border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={!canSubmit ? 'Please complete all required fields and resolve time slot conflicts' : 'Submit emergency reschedule request'}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> : null}
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
