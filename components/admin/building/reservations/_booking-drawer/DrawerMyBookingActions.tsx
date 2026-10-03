'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CalendarClock, XCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DrawerMyBookingActionsProps {
  isEligibleForSelfReschedule: boolean
  isEligibleForSelfEmergencyCancel: boolean
  showSelfEmergencyCancel: boolean
  setShowSelfEmergencyCancel: (v: boolean) => void
  selfCancelReason: string
  setSelfCancelReason: (v: string) => void
  selfCancelSubmitting: boolean
  selfCancelError: string | null
  setSelfCancelError: (v: string | null) => void
  selfCancelDone: boolean
  selfCancelCreditPeso: string | null
  onSelfReschedule: () => void
  onSelfEmergencyCancel: () => Promise<void>
  onClose: () => void
}

export function DrawerMyBookingActions({
  isEligibleForSelfReschedule,
  isEligibleForSelfEmergencyCancel,
  showSelfEmergencyCancel,
  setShowSelfEmergencyCancel,
  selfCancelReason,
  setSelfCancelReason,
  selfCancelSubmitting,
  selfCancelError,
  setSelfCancelError,
  selfCancelDone,
  selfCancelCreditPeso,
  onSelfReschedule,
  onSelfEmergencyCancel,
  onClose,
}: DrawerMyBookingActionsProps) {
  if (!isEligibleForSelfReschedule && !isEligibleForSelfEmergencyCancel) return null

  return (
    <div className="p-6 border-t border-border bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
      <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-widest flex items-center gap-1.5">
        <CalendarClock className="w-3 h-3" /> My Booking
      </p>

      {/* Self-reschedule */}
      {isEligibleForSelfReschedule && !showSelfEmergencyCancel && (
        <Button
          className="w-full rounded-2xl h-11 font-black uppercase text-[10px] bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          onClick={onSelfReschedule}
        >
          <CalendarClock className="w-3.5 h-3.5 mr-2" />
          Reschedule My Booking
        </Button>
      )}

      {/* Self emergency cancel + credit */}
      {isEligibleForSelfEmergencyCancel && !showSelfEmergencyCancel && !selfCancelDone && (
        <Button
          variant="outline"
          className="w-full rounded-2xl h-11 font-black uppercase text-[10px] border-red-200 text-red-600 hover:bg-red-50"
          onClick={() => { setShowSelfEmergencyCancel(true); setSelfCancelReason(''); setSelfCancelError(null) }}
        >
          <XCircle className="w-3.5 h-3.5 mr-2" />
          Emergency Cancel (Get Credit)
        </Button>
      )}

      {/* Inline emergency cancel form */}
      {showSelfEmergencyCancel && !selfCancelDone && (
        <div className="space-y-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 p-4">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            Your booking will be cancelled immediately and a session credit equal to your full payment will be issued to your account.
          </p>
          <Textarea
            placeholder="Reason for emergency cancellation (min. 10 characters)"
            value={selfCancelReason}
            onChange={e => { setSelfCancelReason(e.target.value); setSelfCancelError(null) }}
            rows={3}
            className={cn(selfCancelError && 'border-red-500')}
          />
          <div className="flex items-start justify-between gap-1">
            {selfCancelError
              ? <p className="text-xs text-red-500">{selfCancelError}</p>
              : <span />}
            <span className={cn('text-xs shrink-0 ml-auto', selfCancelReason.trim().length >= 10 ? 'text-emerald-600' : 'text-muted-foreground')}>
              {selfCancelReason.trim().length}/10 min
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button" variant="outline" size="sm" className="flex-1"
              onClick={() => { setShowSelfEmergencyCancel(false); setSelfCancelError(null) }}
              disabled={selfCancelSubmitting}
            >
              Back
            </Button>
            <Button
              type="button" size="sm"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={onSelfEmergencyCancel}
              disabled={selfCancelSubmitting || selfCancelReason.trim().length < 10}
            >
              {selfCancelSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Credit issued confirmation */}
      {selfCancelDone && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-1 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Booking Cancelled</p>
          {selfCancelCreditPeso && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ₱{selfCancelCreditPeso} session credit has been added to your account.
            </p>
          )}
          <Button size="sm" variant="outline" className="mt-2" onClick={onClose}>Close</Button>
        </div>
      )}
    </div>
  )
}
