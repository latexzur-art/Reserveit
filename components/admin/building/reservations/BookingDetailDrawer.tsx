'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CheckCircle2, XCircle, AlertCircle, ShieldCheck,
  AlertTriangle, PauseCircle, Clock, Info, Loader2,
  Banknote
} from 'lucide-react'
import type { BuildingBooking } from '@/backend/admin/building/building.types'
import { CancelAndIssueCreditModal } from './CancelAndIssueCreditModal'
import { AdminExtendDialog } from './AdminExtendDialog'
import { BookingInfoSections } from './booking-detail/BookingInfoSections'
import { SelfRescheduleModal } from './SelfRescheduleModal'
import { useAuth } from '@/contexts/AuthContext'
import { bookingStatusLabel } from '@/lib/enum-labels'
import { DrawerHeader } from './_booking-drawer/DrawerHeader'
import { DrawerMismatchReviewSection } from './_booking-drawer/DrawerMismatchReviewSection'
import { DrawerPendingActions } from './_booking-drawer/DrawerPendingActions'
import { DrawerEmergencyActions } from './_booking-drawer/DrawerEmergencyActions'
import { DrawerProposedReschedule } from './_booking-drawer/DrawerProposedReschedule'
import { DrawerPostDeclineActions } from './_booking-drawer/DrawerPostDeclineActions'
import { DrawerOnHoldActions } from './_booking-drawer/DrawerOnHoldActions'
import { DrawerMyBookingActions } from './_booking-drawer/DrawerMyBookingActions'

interface Props {
  booking: BuildingBooking | null
  onClose: () => void
  onAction: (id: string, action: 'approve' | 'reject' | 'cancel', notes?: string) => Promise<boolean>
  onEmergencyReschedule?: (booking: BuildingBooking) => void
  onEmergencyHold?: (id: string) => Promise<boolean>
  onEmergencyCancelRefund?: (id: string, amountCentavos: number, reason?: string) => Promise<boolean>
  onProposeCancellation?: (id: string, reason: string, refundAmountCentavos: number) => Promise<boolean>
  onAskReschedule?: (id: string, message?: string) => Promise<boolean>
  onMismatchReview?: (id: string, action: 'approve' | 'decline' | 'suggest_alternative', opts?: { alternativeFacilityId?: string; reviewerNotes?: string; alternativeDate?: string; alternativeStartTime?: string; alternativeEndTime?: string }) => Promise<boolean>
}

export function BookingDetailDrawer({ booking, onClose, onAction, onEmergencyReschedule, onEmergencyHold, onEmergencyCancelRefund, onProposeCancellation, onAskReschedule, onMismatchReview }: Props) {
  const { user } = useAuth()
  const [showCancelCreditModal,   setShowCancelCreditModal]   = useState(false)
  const [showAdminExtend,        setShowAdminExtend]        = useState(false)
  const [showProposeCancel,       setShowProposeCancel]       = useState(false)
  const [proposeCancelReason,     setProposeCancelReason]     = useState('')
  const [proposeCancelAmount,     setProposeCancelAmount]     = useState('')
  const [proposeCancelSubmitting, setProposeCancelSubmitting] = useState(false)
  const [proposeCancelError,      setProposeCancelError]      = useState<string | null>(null)
  const [showAskReschedule,      setShowAskReschedule]      = useState(false)
  const [askRescheduleMessage,    setAskRescheduleMessage]   = useState('')
  const [askRescheduleSubmitting, setAskRescheduleSubmitting] = useState(false)
  const [askRescheduleError,      setAskRescheduleError]      = useState<string | null>(null)
  const [showSelfReschedule,      setShowSelfReschedule]      = useState(false)
  const [showSelfEmergencyCancel, setShowSelfEmergencyCancel] = useState(false)
  const [selfCancelReason,        setSelfCancelReason]        = useState('')
  const [selfCancelSubmitting,    setSelfCancelSubmitting]    = useState(false)
  const [selfCancelError,         setSelfCancelError]         = useState<string | null>(null)
  const [selfCancelDone,          setSelfCancelDone]          = useState(false)
  const [selfCancelCreditPeso,    setSelfCancelCreditPeso]    = useState<string | null>(null)
  const [showDeclineForm,         setShowDeclineForm]         = useState(false)
  const [declineReason,           setDeclineReason]           = useState('')
  const [declineSubmitting,       setDeclineSubmitting]       = useState(false)
  const [declineError,            setDeclineError]            = useState<string | null>(null)

  // Cash payment recording state
  const [showCashPayment,        setShowCashPayment]        = useState(false)
  const [cashAmount,             setCashAmount]             = useState('')
  const [cashReceipt,            setCashReceipt]            = useState('')
  const [cashNotes,              setCashNotes]              = useState('')
  const [cashSubmitting,         setCashSubmitting]         = useState(false)
  const [cashError,              setCashError]              = useState<string | null>(null)
  const [cashDone,               setCashDone]               = useState(false)

  // Mismatch review state
  const [mismatchMode,            setMismatchMode]            = useState<'approve' | 'decline' | 'suggest_alternative' | null>(null)
  const [mismatchNotes,           setMismatchNotes]           = useState('')
  const [mismatchAltFacilityId,   setMismatchAltFacilityId]   = useState('')
  const [mismatchAltDate,         setMismatchAltDate]         = useState('')
  const [mismatchAltStart,        setMismatchAltStart]        = useState('')
  const [mismatchAltEnd,          setMismatchAltEnd]          = useState('')
  const [mismatchFacilities,      setMismatchFacilities]      = useState<{ id: string; name: string; room_number: string | null }[]>([])
  const [mismatchSubmitting,      setMismatchSubmitting]      = useState(false)
  const [mismatchError,           setMismatchError]           = useState<string | null>(null)
  const [altAvailBlocked,         setAltAvailBlocked]         = useState<{ start: string; end: string; reason: string }[]>([])
  const [altAvailLoading,         setAltAvailLoading]         = useState(false)
  const [altConflict,             setAltConflict]             = useState<{ available: boolean; conflicts: string[] } | null>(null)
  const [altConflictChecking,     setAltConflictChecking]     = useState(false)

  // Fetch available facilities when suggest_alternative mode is selected
  // Must be before the early return to satisfy Rules of Hooks
  useEffect(() => {
    if (mismatchMode !== 'suggest_alternative' || mismatchFacilities.length > 0) return
    fetch('/api/admin/building/facilities?status=available&pageSize=200')
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setMismatchFacilities((d.facilities ?? []).map((f: any) => ({ id: f.id, name: f.name, room_number: f.roomNumber ?? f.room_number ?? null }))))
      .catch(() => {})
  }, [mismatchMode, mismatchFacilities.length])

  // Fetch blocked ranges for the selected facility + date
  useEffect(() => {
    if (!mismatchAltFacilityId) { setAltAvailBlocked([]); setAltConflict(null); return }
    const dateToCheck = mismatchAltDate || (booking?.bookingDate ?? '')
    if (!dateToCheck) return
    setAltAvailLoading(true)
    setAltConflict(null)
    fetch(`/api/facilities/${mismatchAltFacilityId}/availability?date=${dateToCheck}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setAltAvailBlocked(data?.blocked_ranges ?? []) })
      .catch(() => {})
      .finally(() => setAltAvailLoading(false))
  }, [mismatchAltFacilityId, mismatchAltDate, booking?.bookingDate])

  // Conflict-check when all four fields are filled
  useEffect(() => {
    if (!mismatchAltFacilityId || !mismatchAltDate || !mismatchAltStart || !mismatchAltEnd) {
      setAltConflict(null); return
    }
    setAltConflictChecking(true)
    fetch(
      `/api/facilities/${mismatchAltFacilityId}/conflict-check?date=${mismatchAltDate}&start_time=${mismatchAltStart}&end_time=${mismatchAltEnd}&exclude_booking_id=${booking?.id ?? ''}`
    )
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAltConflict(data) })
      .catch(() => {})
      .finally(() => setAltConflictChecking(false))
  }, [mismatchAltFacilityId, mismatchAltDate, mismatchAltStart, mismatchAltEnd, booking?.id])

  if (!booking) return null

  const getStatusConfig = (status?: string) => {
    if (!status) {
      return { color: 'bg-muted text-muted-foreground', icon: <Info className="w-4 h-4" />, label: 'Unknown' }
    }
    switch (status.toLowerCase()) {
      case 'approved':
        return { color: 'bg-emerald-500/10 text-emerald-600', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Approved' }
      case 'auto_approved':
        return { color: 'bg-emerald-500/10 text-emerald-600', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Approved' }
      case 'pending':
        return { color: 'bg-amber-500/10 text-amber-600', icon: <Clock className="w-4 h-4" />, label: 'Pending' }
      case 'rejected':
        return { color: 'bg-red-500/10 text-red-600', icon: <XCircle className="w-4 h-4" />, label: 'Rejected' }
      case 'cancelled':
        return { color: 'bg-slate-500/10 text-slate-600', icon: <AlertCircle className="w-4 h-4" />, label: 'Cancelled' }
      case 'flagged':
        return { color: 'bg-rose-500/10 text-rose-600', icon: <ShieldCheck className="w-4 h-4" />, label: 'Flagged' }
      case 'pending_user_response':
        return { color: 'bg-orange-500/10 text-orange-700', icon: <AlertTriangle className="w-4 h-4" />, label: 'Awaiting User Response' }
      case 'awaiting_reschedule':
        return { color: 'bg-amber-500/10 text-amber-700', icon: <Clock className="w-4 h-4" />, label: 'Awaiting Reschedule' }
      case 'cancellation_requested':
        return { color: 'bg-orange-500/10 text-orange-700', icon: <AlertCircle className="w-4 h-4" />, label: 'Cancellation Requested' }
      case 'cancellation_proposed':
        return { color: 'bg-rose-500/10 text-rose-700', icon: <AlertTriangle className="w-4 h-4" />, label: 'Cancellation Proposed' }
      case 'on_hold':
        return { color: 'bg-purple-500/10 text-purple-700', icon: <PauseCircle className="w-4 h-4" />, label: 'On Hold' }
      case 'pending_faculty_response':
        return { color: 'bg-orange-500/10 text-orange-700', icon: <AlertTriangle className="w-4 h-4" />, label: 'Awaiting Faculty Response' }
      default:
        return { color: 'bg-muted text-muted-foreground', icon: <Info className="w-4 h-4" />, label: bookingStatusLabel(status) }
    }
  }

  const status = getStatusConfig(booking.currentStatus ?? (booking as any).current_status ?? (booking as any).status)

  const handleApprove = async () => {
    const ok = await onAction(booking.id, 'approve')
    if (ok) onClose()
  }

  const handleReject = async () => {
    const reason = window.prompt('Please provide a reason for rejection:')
    if (reason && reason.trim()) {
      const ok = await onAction(booking.id, 'reject', reason.trim())
      if (ok) onClose()
    }
  }

  const handleEmergencyHold = async () => {
    const ok = await onEmergencyHold?.(booking.id)
    if (ok) onClose()
  }

  const handleEmergencyCancelRefund = async (amountCentavos: number, reason?: string) => {
    const ok = await onEmergencyCancelRefund?.(booking.id, amountCentavos, reason)
    if (ok) {
      setShowCancelCreditModal(false)
      onClose()
    }
  }

  const handleProposeCancellation = async () => {
    if (!proposeCancelReason.trim() || !proposeCancelAmount) return
    setProposeCancelSubmitting(true)
    setProposeCancelError(null)
    try {
      const ok = await onProposeCancellation?.(booking.id, proposeCancelReason.trim(), Math.round(Number(proposeCancelAmount) * 100))
      if (ok) {
        setShowProposeCancel(false)
        setProposeCancelReason('')
        setProposeCancelAmount('')
        onClose()
      } else {
        setProposeCancelError('Failed to propose cancellation. Please check the details and try again.')
      }
    } catch (err: any) {
      setProposeCancelError(err?.message ?? 'Network error. Please try again.')
    } finally {
      setProposeCancelSubmitting(false)
    }
  }

  const handleAskReschedule = async () => {
    setAskRescheduleSubmitting(true)
    setAskRescheduleError(null)
    try {
      const ok = await onAskReschedule?.(booking.id, askRescheduleMessage.trim() || undefined)
      if (ok) {
        setShowAskReschedule(false)
        setAskRescheduleMessage('')
        onClose()
      } else {
        setAskRescheduleError('Failed to send reschedule request. Please try again.')
      }
    } catch (err: any) {
      setAskRescheduleError(err?.message ?? 'Network error. Please try again.')
    } finally {
      setAskRescheduleSubmitting(false)
    }
  }

  const handleMismatchSubmit = async () => {
    if (!onMismatchReview) return
    if (mismatchMode === 'suggest_alternative' && !mismatchAltFacilityId) {
      setMismatchError('Please select an alternative facility.')
      return
    }
    setMismatchSubmitting(true)
    setMismatchError(null)
    const ok = await onMismatchReview(booking.id, mismatchMode!, {
      alternativeFacilityId: mismatchMode === 'suggest_alternative' ? mismatchAltFacilityId : undefined,
      reviewerNotes: mismatchNotes.trim() || undefined,
      alternativeDate: mismatchMode === 'suggest_alternative' ? mismatchAltDate || undefined : undefined,
      alternativeStartTime: mismatchMode === 'suggest_alternative' ? (mismatchAltStart ? mismatchAltStart.slice(0, 5) : undefined) : undefined,
      alternativeEndTime: mismatchMode === 'suggest_alternative' ? (mismatchAltEnd ? mismatchAltEnd.slice(0, 5) : undefined) : undefined,
    })
    setMismatchSubmitting(false)
    if (ok) {
      setMismatchMode(null); setMismatchNotes(''); setMismatchAltFacilityId('')
      setMismatchAltDate(''); setMismatchAltStart(''); setMismatchAltEnd('')
      setAltAvailBlocked([]); setAltConflict(null)
      onClose()
    } else setMismatchError('Action failed. Please try again.')
  }

  // Cash payment handler
  async function handleRecordCashPayment() {
    if (!cashAmount || Number(cashAmount) <= 0) {
      setCashError('Please enter a valid amount.')
      return
    }
    setCashSubmitting(true)
    setCashError(null)
    try {
      const res = await fetch(`/api/admin/building/bookings/${booking!.id}/record-cash-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(cashAmount),
          receipt_number: cashReceipt.trim() || undefined,
          notes: cashNotes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCashError(data.error ?? 'Failed to record payment.'); return }
      setCashDone(true)
    } catch {
      setCashError('An unexpected error occurred.')
    } finally {
      setCashSubmitting(false)
    }
  }

  const isPaidBooking =
    booking.requiresPayment ||
    ['internal_paid', 'external_paid', 'external', 'reservation'].includes((booking.bookingType ?? (booking as any).booking_type ?? '').toLowerCase())

  // Any approved or awaiting_reschedule booking can be rescheduled or managed by an admin
  const isEligibleForEmergencyReschedule =
    ['approved', 'auto_approved', 'awaiting_reschedule', 'pending_user_response', 'pending_faculty_response'].includes(booking.currentStatus ?? (booking as any).current_status ?? '')

  // Payment is considered 'ready' if it's completed OR if the booking doesn't require payment
  const isPaymentSettled = !booking.requiresPayment || booking.paymentStatus === 'completed'

  const isAwaitingUserResponse =
    booking.currentStatus === 'pending_user_response' && isPaidBooking && isPaymentSettled

  const isOnHold =
    booking.currentStatus === 'on_hold' && isPaidBooking && isPaymentSettled

  // Admin extend eligibility — approved gymnasium bookings (personal/community/commercial)
  const bookingPurpose = booking.bookingPurpose ?? (booking as any).booking_purpose ?? ''
  const isExtension = (booking as any).isExtension ?? (booking as any).is_extension ?? false
  const isEligibleForAdminExtend =
    ['approved', 'auto_approved'].includes(booking.currentStatus ?? (booking as any).current_status ?? '') &&
    ['personal', 'community', 'commercial'].includes(bookingPurpose) &&
    !isExtension

  // Self-booking actions — only shown when viewing one's own booking
  const isOwnBooking = !!user && booking.userId === user.id
  const isEligibleForSelfReschedule =
    isOwnBooking && ['approved', 'auto_approved'].includes(booking.currentStatus)
  const isEligibleForSelfEmergencyCancel =
    isOwnBooking &&
    ['approved', 'auto_approved'].includes(booking.currentStatus) &&
    isPaidBooking &&
    booking.paymentStatus === 'completed'

  async function handleSelfEmergencyCancel() {
    if (!selfCancelReason.trim() || selfCancelReason.trim().length < 10) {
      setSelfCancelError('Please provide a reason (at least 10 characters).')
      return
    }
    setSelfCancelSubmitting(true)
    setSelfCancelError(null)
    try {
      const res  = await fetch(`/api/bookings/${booking!.id}/self-emergency-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: selfCancelReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setSelfCancelError(data.error ?? 'Failed to cancel.'); return }
      setSelfCancelDone(true)
      setSelfCancelCreditPeso(
        data.credit_issued_centavos != null
          ? (data.credit_issued_centavos / 100).toFixed(2)
          : null
      )
    } catch {
      setSelfCancelError('An unexpected error occurred.')
    } finally {
      setSelfCancelSubmitting(false)
    }
  }

  return (
    <>
    <Sheet open={!!booking} onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] flex flex-col p-0 overflow-hidden">
        <DrawerHeader booking={booking} status={status} />

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            <BookingInfoSections booking={booking} isPaidBooking={isPaidBooking} />
          </div>
        </ScrollArea>

        {/* MISMATCH REVIEW ACTIONS — flagged bookings */}
        {onMismatchReview && (
          <DrawerMismatchReviewSection
            booking={booking}
            mismatchMode={mismatchMode}
            setMismatchMode={setMismatchMode}
            mismatchNotes={mismatchNotes}
            setMismatchNotes={setMismatchNotes}
            mismatchAltFacilityId={mismatchAltFacilityId}
            setMismatchAltFacilityId={setMismatchAltFacilityId}
            mismatchAltDate={mismatchAltDate}
            setMismatchAltDate={setMismatchAltDate}
            mismatchAltStart={mismatchAltStart}
            setMismatchAltStart={setMismatchAltStart}
            mismatchAltEnd={mismatchAltEnd}
            setMismatchAltEnd={setMismatchAltEnd}
            mismatchFacilities={mismatchFacilities}
            mismatchSubmitting={mismatchSubmitting}
            mismatchError={mismatchError}
            setMismatchError={setMismatchError}
            altAvailBlocked={altAvailBlocked}
            setAltAvailBlocked={setAltAvailBlocked}
            altAvailLoading={altAvailLoading}
            altConflict={altConflict}
            setAltConflict={setAltConflict}
            altConflictChecking={altConflictChecking}
            onMismatchSubmit={handleMismatchSubmit}
          />
        )}

        {/* PENDING APPROVAL ACTIONS */}
        <DrawerPendingActions booking={booking} onApprove={handleApprove} onReject={handleReject} />

        {/* EMERGENCY ACTIONS — for approved bookings */}
        <DrawerEmergencyActions
          booking={booking}
          isEligibleForEmergencyReschedule={isEligibleForEmergencyReschedule}
          isPaidBooking={isPaidBooking}
          onEmergencyReschedule={onEmergencyReschedule}
          onShowCancelCreditModal={() => setShowCancelCreditModal(true)}
          showDeclineForm={showDeclineForm}
          setShowDeclineForm={setShowDeclineForm}
          declineReason={declineReason}
          setDeclineReason={setDeclineReason}
          declineSubmitting={declineSubmitting}
          setDeclineSubmitting={setDeclineSubmitting}
          declineError={declineError}
          setDeclineError={setDeclineError}
          onAction={onAction}
          onClose={onClose}
        />

        {/* PROPOSED RESCHEDULE — visible when either party's proposal is pending */}
        <DrawerProposedReschedule booking={booking} onCancel={onAction} />

        {/* POST-DECLINE ACTIONS — user declined, admin must choose */}
        <DrawerPostDeclineActions
          isAwaitingUserResponse={isAwaitingUserResponse}
          onEmergencyHold={handleEmergencyHold}
          onShowCancelCreditModal={() => setShowCancelCreditModal(true)}
        />

        {/* ON-HOLD ACTIONS */}
        <DrawerOnHoldActions isOnHold={isOnHold} onShowCancelCreditModal={() => setShowCancelCreditModal(true)} />

        {/* RECORD CASH PAYMENT — for approved bookings without completed payment */}
        {(() => {
          const currentStatus = booking.currentStatus ?? (booking as any).current_status ?? ''
          const isApproved = ['approved', 'auto_approved'].includes(currentStatus)
          const hasNoCompletedPayment = booking.paymentStatus !== 'completed'
          const canRecordCash = isApproved && isPaidBooking && hasNoCompletedPayment
          if (!canRecordCash) return null
          return (
            <div className="p-6 border-t border-border space-y-3">
              {!showCashPayment && !cashDone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setCashAmount(''); setCashReceipt(''); setCashNotes(''); setCashError(null); setShowCashPayment(true) }}
                  className="w-full rounded-xl text-xs font-bold h-9 border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                >
                  <Banknote className="w-3.5 h-3.5 mr-1.5" />
                  Record Cash Payment
                </Button>
              )}
              {cashDone && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl p-3">
                  <CheckCircle2 className="w-4 h-4" />
                  Cash payment recorded successfully.
                </div>
              )}
              {showCashPayment && !cashDone && (
                <div className="space-y-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20 p-4">
                  <p className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">Record Cash Payment</p>
                  {cashError && (
                    <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                      {cashError}
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Amount (₱) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      value={cashAmount}
                      onChange={e => { setCashAmount(e.target.value); setCashError(null) }}
                      className="rounded-xl text-xs h-11"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Receipt Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      value={cashReceipt}
                      onChange={e => setCashReceipt(e.target.value)}
                      className="rounded-xl text-xs h-11"
                      placeholder="e.g., RCP-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Textarea
                      value={cashNotes}
                      onChange={e => setCashNotes(e.target.value)}
                      rows={2}
                      className="rounded-xl text-xs resize-none"
                      placeholder="Any additional notes..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowCashPayment(false); setCashError(null) }}
                      className="flex-1 rounded-xl text-xs font-bold h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!cashAmount || Number(cashAmount) <= 0 || cashSubmitting}
                      onClick={handleRecordCashPayment}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-9"
                    >
                      {cashSubmitting ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Recording...
                        </span>
                      ) : 'Record Payment'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ADMIN EXTEND — for approved gymnasium bookings */}
        {isEligibleForAdminExtend && (
          <div className="p-6 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdminExtend(true)}
              className="w-full rounded-xl text-xs font-bold h-9 border-accent-brand/30 text-accent-brand hover:bg-accent-brand/10"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Extend Booking
            </Button>
          </div>
        )}

        {/* PROPOSE CANCELLATION — for paid bookings, sends proposal to booker */}
        {isPaidBooking && onProposeCancellation && !showProposeCancel && !showAskReschedule && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setProposeCancelReason(''); setProposeCancelAmount(''); setShowProposeCancel(true) }}
              className="w-full rounded-xl text-xs font-bold h-9 border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              Propose Cancellation (Cash Refund)
            </Button>
          </div>
        )}

        {/* ASK USER TO RESCHEDULE — user picks their own date */}
        {onAskReschedule && !showAskReschedule && !showProposeCancel && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAskRescheduleMessage(''); setShowAskReschedule(true) }}
              className="w-full rounded-xl text-xs font-bold h-9 border-blue-300 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
            >
              Ask User to Reschedule
            </Button>
          </div>
        )}
        {showProposeCancel && (
          <div className="space-y-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-500/20 p-4">
            <p className="text-xs font-bold uppercase text-rose-800 dark:text-rose-300 tracking-wider">Propose Cancellation</p>
            {proposeCancelError && (
              <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                {proposeCancelError}
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Reason</Label>
              <Textarea value={proposeCancelReason} onChange={e => { setProposeCancelReason(e.target.value); setProposeCancelError(null) }} rows={3} className="rounded-xl text-xs" placeholder="Explain why the booking needs to be cancelled..." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Refund Amount (₱)</Label>
              <Input type="number" value={proposeCancelAmount} onChange={e => { setProposeCancelAmount(e.target.value); setProposeCancelError(null) }} className="rounded-xl text-xs h-11" placeholder="0.00" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowProposeCancel(false); setProposeCancelError(null) }} className="flex-1 rounded-xl text-xs font-bold h-9">Cancel</Button>
              <Button size="sm" disabled={proposeCancelReason.trim().length < 10 || !proposeCancelAmount || proposeCancelSubmitting} onClick={handleProposeCancellation} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold h-9">
                {proposeCancelSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending...
                  </span>
                ) : 'Send Proposal'}
              </Button>
            </div>
          </div>
        )}

        {showAskReschedule && (
          <div className="space-y-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-500/20 p-4">
            <p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-300 tracking-wider">Ask User to Reschedule</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              The user will be prompted to pick a new date and time from available slots.
            </p>
            {askRescheduleError && (
              <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                {askRescheduleError}
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Message (optional)</Label>
              <Textarea value={askRescheduleMessage} onChange={e => { setAskRescheduleMessage(e.target.value); setAskRescheduleError(null) }} rows={2} className="rounded-xl text-xs" placeholder="Optional message to the user..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowAskReschedule(false); setAskRescheduleError(null) }} className="flex-1 rounded-xl text-xs font-bold h-9">Cancel</Button>
              <Button size="sm" disabled={askRescheduleSubmitting} onClick={handleAskReschedule} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold h-9">
                {askRescheduleSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending...
                  </span>
                ) : 'Send Request'}
              </Button>
            </div>
          </div>
        )}

        {/* MY BOOKING ACTIONS — only shown to the building admin who owns this booking */}
        <DrawerMyBookingActions
          isEligibleForSelfReschedule={isEligibleForSelfReschedule}
          isEligibleForSelfEmergencyCancel={isEligibleForSelfEmergencyCancel}
          showSelfEmergencyCancel={showSelfEmergencyCancel}
          setShowSelfEmergencyCancel={setShowSelfEmergencyCancel}
          selfCancelReason={selfCancelReason}
          setSelfCancelReason={setSelfCancelReason}
          selfCancelSubmitting={selfCancelSubmitting}
          selfCancelError={selfCancelError}
          setSelfCancelError={setSelfCancelError}
          selfCancelDone={selfCancelDone}
          selfCancelCreditPeso={selfCancelCreditPeso}
          onSelfReschedule={() => setShowSelfReschedule(true)}
          onSelfEmergencyCancel={handleSelfEmergencyCancel}
          onClose={onClose}
        />

        {showSelfReschedule && (
          <SelfRescheduleModal
            open={showSelfReschedule}
            onClose={() => setShowSelfReschedule(false)}
            onSuccess={() => { setShowSelfReschedule(false); onClose() }}
            bookingId={booking.id}
            bookingReference={booking.bookingReference}
            currentDate={booking.bookingDate}
            currentStart={booking.startTime?.slice(0, 5) ?? ''}
            currentEnd={booking.endTime?.slice(0, 5) ?? ''}
          />
        )}

        <AdminExtendDialog
          booking={booking}
          open={showAdminExtend}
          onClose={() => setShowAdminExtend(false)}
          onSuccess={() => { setShowAdminExtend(false); onClose() }}
        />

        {showCancelCreditModal && (
          <CancelAndIssueCreditModal
            bookingId={booking.id}
            bookingRef={booking.bookingReference}
            facilityName={booking.facilities?.[0]?.name ?? 'Facility'}
            onConfirm={handleEmergencyCancelRefund}
            onClose={() => setShowCancelCreditModal(false)}
          />
        )}
      </SheetContent>
    </Sheet>
    </>
  )
}

// ── Inline credit history for a booking ──────────────────────────────────────
