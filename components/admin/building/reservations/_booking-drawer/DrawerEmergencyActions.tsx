'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, XCircle, Wallet, Loader2 } from 'lucide-react'
import type { BuildingBooking } from '@/backend/admin/building/building.types'
import { cn } from '@/lib/utils'

interface DrawerEmergencyActionsProps {
  booking: BuildingBooking
  isEligibleForEmergencyReschedule: boolean
  isPaidBooking: boolean
  onEmergencyReschedule?: (booking: BuildingBooking) => void
  onShowCancelCreditModal: () => void
  showDeclineForm: boolean
  setShowDeclineForm: (v: boolean) => void
  declineReason: string
  setDeclineReason: (v: string) => void
  declineSubmitting: boolean
  setDeclineSubmitting: (v: boolean) => void
  declineError: string | null
  setDeclineError: (v: string | null) => void
  onAction: (id: string, action: 'approve' | 'reject' | 'cancel', notes?: string) => Promise<boolean>
  onClose: () => void
}

export function DrawerEmergencyActions({
  booking,
  isEligibleForEmergencyReschedule,
  isPaidBooking,
  onEmergencyReschedule,
  onShowCancelCreditModal,
  showDeclineForm,
  setShowDeclineForm,
  declineReason,
  setDeclineReason,
  declineSubmitting,
  setDeclineSubmitting,
  declineError,
  setDeclineError,
  onAction,
  onClose,
}: DrawerEmergencyActionsProps) {
  if (!isEligibleForEmergencyReschedule) return null

  return (
    <div className="p-6 border-t border-border bg-amber-50/50 dark:bg-amber-950/20">
      <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 mb-3 tracking-widest flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" /> Reservation Controls
      </p>
      <div className="flex gap-3">
        <Button
          className="flex-1 rounded-2xl h-11 font-black uppercase text-[10px] bg-amber-600 hover:bg-amber-700 text-white shadow-lg"
          onClick={() => onEmergencyReschedule?.(booking)}
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-2" />
          Reschedule
        </Button>

        {isPaidBooking ? (
          <Button
            variant="outline"
            className="flex-1 rounded-2xl h-11 font-black uppercase text-[10px] border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={onShowCancelCreditModal}
          >
            <Wallet className="w-3.5 h-3.5 mr-1.5" />
            Cancel & Issue Credit
          </Button>
        ) : (
          !showDeclineForm ? (
            <Button
              variant="outline"
              className="flex-1 rounded-2xl h-11 font-black uppercase text-[10px] border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => { setShowDeclineForm(true); setDeclineReason(''); setDeclineError(null) }}
            >
              <XCircle className="w-3.5 h-3.5 mr-2" />
              Decline / Cancel
            </Button>
          ) : null
        )}
      </div>

      {/* Inline decline reason form for non-paid bookings */}
      {showDeclineForm && (
        <div className="mt-3 space-y-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 p-4">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            The booking will be cancelled immediately. Please provide a reason.
          </p>
          <Textarea
            placeholder="Cancellation reason (min. 10 characters)"
            value={declineReason}
            onChange={e => { setDeclineReason(e.target.value); setDeclineError(null) }}
            rows={3}
            className={cn(declineError && 'border-red-500')}
          />
          <div className="flex items-start justify-between gap-1">
            {declineError
              ? <p className="text-xs text-red-500">{declineError}</p>
              : <span />}
            <span className={cn('text-xs shrink-0 ml-auto', declineReason.trim().length >= 10 ? 'text-emerald-600' : 'text-muted-foreground')}>
              {declineReason.trim().length}/10 min
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button" variant="outline" size="sm" className="flex-1"
              onClick={() => { setShowDeclineForm(false); setDeclineError(null) }}
              disabled={declineSubmitting}
            >
              Back
            </Button>
            <Button
              type="button" size="sm"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={declineSubmitting || declineReason.trim().length < 10}
              onClick={async () => {
                if (declineReason.trim().length < 10) {
                  setDeclineError('Please provide a reason (at least 10 characters).')
                  return
                }
                setDeclineSubmitting(true)
                setDeclineError(null)
                const ok = await onAction(booking.id, 'cancel', declineReason.trim())
                setDeclineSubmitting(false)
                if (ok) { setShowDeclineForm(false); onClose() }
                else setDeclineError('Failed to cancel. Please try again.')
              }}
            >
              {declineSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
