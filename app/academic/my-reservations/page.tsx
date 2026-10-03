"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Plus, Calendar, Loader2, X, AlertTriangle, CheckCircle, Clock, MapPin, Hash, PauseCircle, Phone } from 'lucide-react'
import { useReservations, type ReservationItem } from '@/hooks/faculty/useReservations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExtendBookingModal } from '@/components/bookings/ExtendBookingModal'
import { RequestEmergencyCancellationModal } from '@/components/bookings/RequestEmergencyCancellationModal'
import { RequestRescheduleModal } from '@/components/bookings/RequestRescheduleModal'
import { cn } from '@/lib/utils'
import { bookingPurposeLabel, bookingStatusLabel } from '@/lib/enum-labels'
import { ROUTES } from '@/lib/routes'
import { SkeletonList } from "@/components/ui/SkeletonList";
import { UnreviewedBookingsPanel } from '@/components/shared/facilities/UnreviewedBookingsPanel'


const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'auto_approved,approved,overridden', label: 'Approved' },
  { value: 'flagged,pending', label: 'Pending Review' },
  { value: 'pending_faculty_response,pending_user_response', label: 'Action Required' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'auto_declined,rejected', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_BADGE: Record<string, string> = {
  auto_approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 font-semibold',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 font-semibold',
  overridden: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 font-semibold',
  flagged: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 font-semibold',
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 font-semibold',
  pending_faculty_response: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300 font-semibold',
  pending_user_response: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300 font-semibold',
  on_hold: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400 font-semibold',
  cancellation_requested: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400 font-semibold',
  cancellation_proposed: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 font-semibold',
  auto_declined: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 font-semibold',
  rejected: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 font-semibold',
  cancelled: 'bg-muted text-muted-foreground border-border font-medium',
  completed: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400 font-semibold',
}

const STATUS_LABEL: Record<string, string> = {
  auto_approved: 'Approved', approved: 'Approved', overridden: 'Overridden',
  flagged: 'Pending Review', pending: 'Pending',
  pending_faculty_response: 'Action Required', pending_user_response: 'Action Required',
  on_hold: 'On Hold', cancellation_requested: 'Cancel Requested', cancellation_proposed: 'Cancellation Proposed', auto_declined: 'Declined', rejected: 'Declined',
  cancelled: 'Cancelled', completed: 'Completed',
}

export default function AcademicMyReservationsPage() {
  const {
    bookings, total, page, setPage, totalPages,
    statusFilter, setStatusFilter,
    loading, cancelling, cancelBooking,
    respondToEmergency, submitEmergencyRequest, submitRescheduleRequest, withdrawRescheduleRequest, respondingId,
  } = useReservations()

  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [search, setSearch] = useState('')
  const [extendBooking, setExtendBooking] = useState<ReservationItem | null>(null)
  const [emergencyBookingId, setEmergencyBookingId] = useState<string | null>(null)
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null)
  const [helpdeskPhone, setHelpdeskPhone] = useState<string>('')
  const [helpdeskEmail, setHelpdeskEmail] = useState<string>('')
  const [dismissedRescheduleDeclineIds, setDismissedRescheduleDeclineIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissed_reschedule_decline_ids') ?? '[]')) }
    catch { return new Set() }
  })

  const dismissRescheduleDecline = (requestId: string) => {
    setDismissedRescheduleDeclineIds(prev => {
      const next = new Set(prev)
      next.add(requestId)
      try { localStorage.setItem('dismissed_reschedule_decline_ids', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const needsHelpdeskInfo = bookings.some(b =>
    b.current_status === 'pending_user_response' ||
    b.current_status === 'on_hold' ||
    (['approved', 'auto_approved'].includes(b.current_status) && b.has_completed_payment)
  )

  useEffect(() => {
    if (!needsHelpdeskInfo) return
    let cancelled = false
    fetch('/api/settings/helpdesk-phone')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return
        setHelpdeskPhone(data.helpdeskPhone ?? '')
        setHelpdeskEmail(data.helpdeskEmail ?? '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [needsHelpdeskInfo])

  const filtered = search
    ? bookings.filter(b =>
        b.facility_name.toLowerCase().includes(search.toLowerCase()) ||
        b.booking_reference.toLowerCase().includes(search.toLowerCase()) ||
        b.purpose.toLowerCase().includes(search.toLowerCase())
      )
    : bookings

  const handleCancel = async () => {
    if (!cancelId) return
    await cancelBooking(cancelId, cancelReason || undefined)
    setCancelId(null)
    setCancelReason('')
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <UnreviewedBookingsPanel />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">My <span className="text-accent-brand">Reservations</span></h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
            {total} total facility reservations for STI College Lucena
          </p>
        </div>
        
        <Button asChild className="rounded-xl font-semibold text-xs h-10 px-5 shadow-sm">
          <Link href={ROUTES.academic.reserve}>
            <Plus className="w-4 h-4 mr-2" /> New Reservation
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by facility, reference code, or purpose..."
            className="w-full pl-10 pr-4 h-10 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-border/80'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-xs">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-foreground">
              {search ? 'No matching reservations found' : 'No reservations recorded'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Try clearing filters or search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map(booking => (
              <div
                key={booking.id}
                className="bg-card p-6 rounded-2xl border border-border hover:border-border/80 transition-all shadow-xs space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-base text-foreground tracking-tight">
                          {booking.facility_name}
                        </h3>
                      </div>
                      <Badge className={cn("rounded-lg px-2.5 py-0.5 text-[11px] border transition-colors", STATUS_BADGE[booking.current_status] ?? STATUS_BADGE.pending)}>
                        {STATUS_LABEL[booking.current_status] ?? bookingStatusLabel(booking.current_status)}
                      </Badge>
                      {booking.pending_reschedule_request && (
                        <Badge className={cn(
                          "rounded-lg px-2.5 py-0.5 text-[11px] border font-semibold",
                          booking.pending_reschedule_request.status === 'pending_extra_payment'
                            ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                            : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                        )}>
                          {booking.pending_reschedule_request.status === 'pending_extra_payment' ? 'Pending Extra Payment' : 'Reschedule Requested'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-y-2 gap-x-6 text-xs text-muted-foreground font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{booking.booking_date}</span>
                        <span>•</span>
                        <span>{booking.start_time} – {booking.end_time}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">#{booking.booking_reference}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-3 border-t border-border/50">
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground">Purpose</p>
                        <p className="text-xs font-semibold text-foreground truncate">{booking.purpose}</p>
                      </div>
                      {booking.expected_attendees && (
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold text-muted-foreground">Expected Attendees</p>
                          <p className="text-xs font-semibold text-foreground">{booking.expected_attendees} Pax</p>
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground">Category</p>
                        <p className="text-xs font-semibold text-foreground capitalize">
                          {bookingPurposeLabel(booking.booking_purpose)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end gap-2 shrink-0">
                    {(() => {
                      const paymentPurposes = ['personal', 'community', 'commercial']
                      const isGymPersonal = booking.booking_type === 'internal_paid' && paymentPurposes.includes(booking.booking_purpose)
                      const isPaid = !booking.requires_payment
                      const isApproved = ['approved', 'auto_approved'].includes(booking.current_status)
                      const isNotExtension = !booking.is_extension
                      const today = new Date().toISOString().slice(0, 10)
                      const isUpcoming = booking.booking_date >= today
                      if (!isGymPersonal || !isPaid || !isApproved || !isNotExtension || !isUpcoming) return null
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExtendBooking(booking)}
                          className="rounded-xl font-semibold text-xs h-9 px-3.5"
                        >
                          <Clock className="w-3.5 h-3.5 mr-1.5" /> Extend
                        </Button>
                      )
                    })()}
                    {(['pending', 'flagged'].includes(booking.current_status) ||
                      (['approved', 'auto_approved'].includes(booking.current_status) && !booking.has_completed_payment)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setCancelId(booking.id); setCancelReason('') }}
                        disabled={cancelling === booking.id}
                        className="rounded-xl font-semibold text-xs h-9 px-3.5 text-destructive hover:bg-destructive/10"
                      >
                        {cancelling === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                        Cancel Reservation
                      </Button>
                    )}
                    {['approved', 'auto_approved'].includes(booking.current_status) && booking.has_completed_payment && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEmergencyBookingId(booking.id)}
                        className="rounded-xl font-semibold text-xs h-9 px-3.5 text-destructive hover:bg-destructive/10"
                      >
                        Cancel Reservation
                      </Button>
                    )}
                  </div>
                </div>

                {/* On Hold banner */}
                {booking.current_status === 'on_hold' && (
                  <div className="mt-4 flex items-start gap-3 bg-purple-500/10 p-4 rounded-xl border border-purple-500/20">
                    <PauseCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-purple-900 dark:text-purple-200">Reservation On Hold</p>
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                        Your reservation is currently on hold. Please contact the helpdesk for assistance.
                      </p>
                      {helpdeskPhone && (
                        <div className="flex items-center gap-2 mt-2 bg-background px-3 py-1.5 rounded-lg border border-purple-500/20 w-fit">
                          <Phone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-semibold text-foreground">{helpdeskPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 pt-6">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1} 
              onClick={() => setPage(page - 1)}
              className="rounded-xl font-semibold text-xs h-9 px-4"
            >
              Previous
            </Button>
            <span className="text-xs font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= totalPages} 
              onClick={() => setPage(page + 1)}
              className="rounded-xl font-semibold text-xs h-9 px-4"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Emergency Reschedule Request Modal */}
      {rescheduleBookingId && (() => {
        const b = bookings.find(b => b.id === rescheduleBookingId)
        if (!b) return null
        return (
          <RequestRescheduleModal
            bookingId={b.id}
            bookingRef={b.booking_reference}
            facilityName={b.facility_name}
            bookingDate={b.booking_date}
            startTime={b.start_time}
            endTime={b.end_time}
            helpdeskPhone={helpdeskPhone}
            helpdeskEmail={helpdeskEmail}
            onSubmit={async (data) => {
              const result = await submitRescheduleRequest(b.id, {
                reason: data.reason,
                attachmentUrl: data.attachmentUrl,
                proposedDate: data.proposedDate,
                proposedStartTime: data.proposedStartTime,
                proposedEndTime: data.proposedEndTime,
              })
              return result.success
            }}
            onClose={() => setRescheduleBookingId(null)}
          />
        )
      })()}

      {/* Emergency Cancellation Modal */}
      {emergencyBookingId && (() => {
        const b = bookings.find(b => b.id === emergencyBookingId)
        if (!b) return null
        return (
          <RequestEmergencyCancellationModal
            bookingRef={b.booking_reference}
            facilityName={b.facility_name}
            bookingDate={b.booking_date}
            bookingTime={`${b.start_time} – ${b.end_time}`}
            requiresPayment={b.has_completed_payment}
            helpdeskPhone={helpdeskPhone}
            helpdeskEmail={helpdeskEmail}
            onSubmit={(reason, attachmentUrl) =>
              submitEmergencyRequest(b.id, reason, attachmentUrl)
            }
            onClose={() => setEmergencyBookingId(null)}
          />
        )
      })()}

      {/* Extend Modal */}
      {extendBooking && (
        <ExtendBookingModal
          bookingId={extendBooking.id}
          bookingReference={extendBooking.booking_reference}
          currentEndTime={extendBooking.end_time}
          bookingDate={extendBooking.booking_date}
          facilityId={extendBooking.facility_id}
          addonSound={extendBooking.metadata?.addon_sound === true}
          addonLed={extendBooking.metadata?.addon_led === true}
          onClose={() => setExtendBooking(null)}
          onSuccess={() => setExtendBooking(null)}
        />
      )}

      {/* Direct Cancel Modal */}
      {cancelId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xs" onClick={() => setCancelId(null)} />
          <div className="relative bg-card rounded-2xl shadow-xl p-6 max-w-md w-full border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Cancel Reservation</h3>
              <Button variant="ghost" size="icon" onClick={() => setCancelId(null)} className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to cancel this reservation? This action is permanent and releases the reserved slot back into the facility pool.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Reason for Cancellation <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Schedule adjustment or event postponed"
                rows={3}
                className="w-full border border-border rounded-xl px-3 py-2 text-xs bg-background text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setCancelId(null)} className="flex-1 font-semibold text-xs h-9 rounded-xl order-2 sm:order-1">
                Keep Booking
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling !== null} className="flex-1 font-semibold text-xs h-9 rounded-xl order-1 sm:order-2">
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}

