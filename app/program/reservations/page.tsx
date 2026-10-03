"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Plus, Calendar, Loader2, X, AlertTriangle, CheckCircle, Clock, PauseCircle } from 'lucide-react'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { useReservations, type ReservationItem } from '@/hooks/faculty/useReservations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExtendBookingModal } from '@/components/bookings/ExtendBookingModal'
import { RequestEmergencyCancellationModal } from '@/components/bookings/RequestEmergencyCancellationModal'
import { RequestRescheduleModal } from '@/components/bookings/RequestRescheduleModal'
import { UnreviewedBookingsPanel } from '@/components/shared/facilities/UnreviewedBookingsPanel'
import { RequestCancellationDialog } from '@/components/cancellation/RequestCancellationDialog'
import { bookingPurposeLabel, bookingStatusLabel } from '@/lib/enum-labels'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'auto_approved,approved,overridden', label: 'Approved' },
  { value: 'flagged,pending', label: 'Pending Review' },
  { value: 'pending_faculty_response,pending_user_response', label: 'Action Required' },
  { value: 'auto_declined,rejected', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_BADGE: Record<string, string> = {
  auto_approved: 'bg-green-50 text-green-800 ring-1 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20',
  approved: 'bg-green-50 text-green-800 ring-1 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20',
  overridden: 'bg-green-50 text-green-800 ring-1 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20',
  flagged: 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-600/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:ring-yellow-500/20',
  pending: 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-600/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:ring-yellow-500/20',
  pending_faculty_response: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400 dark:ring-orange-500/20',
  pending_user_response: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400 dark:ring-orange-500/20',
  on_hold: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400',
  cancellation_requested: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400',
  cancellation_proposed: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400',
  auto_declined: 'bg-red-50 text-red-800 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  rejected: 'bg-red-50 text-red-800 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  completed: 'bg-blue-50 text-blue-800 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  auto_approved: 'Approved',
  approved: 'Approved',
  overridden: 'Overridden',
  flagged: 'Pending Review',
  pending: 'Pending',
  pending_faculty_response: 'Action Required',
  pending_user_response: 'Action Required',
  on_hold: 'On Hold',
  cancellation_requested: 'Cancel Requested',
  cancellation_proposed: 'Cancellation Proposed',
  auto_declined: 'Declined',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

const CANCELLABLE_STATUSES = ['flagged', 'pending', 'auto_approved', 'approved']

export default function ReservationsPage() {
  const {
    bookings,
    total,
    page,
    setPage,
    totalPages,
    statusFilter,
    setStatusFilter,
    loading,
    respondToAlternative,
    respondToProposal,
    respondToEmergency,
    submitEmergencyRequest,
    submitRescheduleRequest,
    withdrawRescheduleRequest,
    respondingId,
    refresh,
  } = useReservations()

  const [search, setSearch] = useState('')
  const [respondingToId, setRespondingToId] = useState<string | null>(null)
  const [respondingToProposalId, setRespondingToProposalId] = useState<string | null>(null)
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
    ['approved', 'auto_approved'].includes(b.current_status)
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

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <ConnectedTopBar title="My Reservations" breadcrumbs={[{ label: 'Dashboard' }]} />

      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6"><UnreviewedBookingsPanel /></div>
        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reservations..."
                aria-label="Search reservations"
                className="w-full pl-10 pr-4 h-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-foreground transition-all"
              />
            </div>

            {/* Status filters - Scrollable on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === opt.value
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <Button asChild className="w-full lg:w-auto font-bold">
              <Link href="/program/form">
                <Plus className="w-4 h-4 mr-2" />
                New Reservation
              </Link>
            </Button>
          </div>
        </div>

        {/* List Title */}
        <div className="mb-4">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
            {statusFilter
              ? `${STATUS_OPTIONS.find(s => s.value === statusFilter)?.label} Reservations`
              : 'All Reservations'}
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">({total})</span>
          </h2>
        </div>

        {/* List Content */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse">
                  <div className="flex flex-col md:flex-row justify-between items-start mb-5 gap-4">
                    <div className="space-y-3 w-full md:w-1/2">
                      <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                      <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    </div>
                    <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                {search ? 'No matches found for your search.' : 'No active reservations found.'}
              </p>
              <Button asChild variant="link" className="mt-2">
                <Link href="/program/form" className="gap-2">
                  <Plus className="w-4 h-4" /> Create one now
                </Link>
              </Button>
            </div>
          ) : (
            filtered.map(booking => (
              <div
                key={booking.id}
                className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 transition-colors shadow-sm"
              >
                {/* Card Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                        {booking.facility_name}
                      </h3>
                      {booking.building_name && (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {booking.building_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {booking.booking_date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {booking.start_time} – {booking.end_time}</span>
                      <span className="text-xs opacity-70">Ref: #{booking.booking_reference}</span>
                    </div>
                  </div>
                  <Badge className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight w-fit ${STATUS_BADGE[booking.current_status] ?? STATUS_BADGE.pending}`}>
                    {STATUS_LABEL[booking.current_status] ?? bookingStatusLabel(booking.current_status)}
                  </Badge>
                  {booking.pending_reschedule_request && (
                    <Badge className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight w-fit border ${
                      booking.pending_reschedule_request.status === 'pending_extra_payment'
                        ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                        : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    }`}>
                      {booking.pending_reschedule_request.status === 'pending_extra_payment' ? 'Pending Payment' : 'Reschedule Requested'}
                    </Badge>
                  )}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-t border-slate-100 dark:border-slate-800/50 text-sm mb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Purpose</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{booking.purpose}</p>
                  </div>
                  {booking.expected_attendees && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Attendees</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{booking.expected_attendees}</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Type</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {bookingPurposeLabel(booking.booking_purpose)}
                    </p>
                  </div>
                  {booking.course_code && (
                    <div>
                      <p className="text-muted-foreground">Course / Subject</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {booking.course_code}
                        {booking.course_name && (
                          <span className="font-normal text-muted-foreground"> — {booking.course_name}</span>
                        )}
                        {booking.session_type && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {booking.session_type}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Conditional Alerts */}
                {booking.current_status === 'flagged' && (
                   <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg mb-4 border border-amber-200 dark:border-amber-800/30">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 leading-relaxed">
                      {booking.mismatch_flag === 'UNRECOGNIZED_CROSS_DEPT_USE' 
                        ? 'Under review by Academic Head. Cross-department facility use requires manual authorization.'
                        : 'Awaiting admin review. You will be notified via email once a decision is finalized.'}
                    </p>
                  </div>
                )}

                {/* Proposals & Actionable sections */}
                {booking.current_status === 'pending_faculty_response' && (booking.mismatch_alternative_facility_id || booking.pending_proposal) && (
                  <div className="mb-4 p-6 rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/5 shadow-xl shadow-orange-500/5">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="bg-orange-500 dark:bg-orange-400 rounded-lg p-2 shrink-0">
                        <AlertTriangle className="w-5 h-5 text-white dark:text-slate-900" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-orange-900 dark:text-orange-200 uppercase tracking-tight">Facility Suggestion</p>
                        <p className="text-xs font-medium text-orange-700 dark:text-orange-300/70 mt-1 leading-relaxed">
                          {(() => {
                            const reviewer = booking.mismatch_reviewer
                            const roleLabel = reviewer?.role === 'building_admin'
                              ? 'Building Admin'
                              : reviewer?.role === 'academic_head'
                              ? 'Academic Head'
                              : 'Reviewer'
                            const who = reviewer?.name ? `${roleLabel} ${reviewer.name}` : `the ${roleLabel}`
                            return `The original room is unavailable for this slot. ${who} has proposed an alternative space.`
                          })()}
                        </p>
                        {booking.mismatch_alternative_facility && (
                          <div className="mt-3 rounded-xl border border-orange-200 dark:border-orange-500/20 bg-white/60 dark:bg-orange-950/30 px-3 py-2 space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400">Proposed alternative</p>
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] uppercase tracking-widest text-orange-600/70 dark:text-orange-300/60 min-w-[60px]">Facility</span>
                              <span className="text-[11px] font-bold text-orange-900 dark:text-orange-100">
                                {booking.mismatch_alternative_facility.name}
                                {booking.mismatch_alternative_facility.room_number ? ` (Room ${booking.mismatch_alternative_facility.room_number})` : ''}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] uppercase tracking-widest text-orange-600/70 dark:text-orange-300/60 min-w-[60px]">Date</span>
                              <span className="text-[11px] font-bold text-orange-900 dark:text-orange-100">{booking.booking_date}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] uppercase tracking-widest text-orange-600/70 dark:text-orange-300/60 min-w-[60px]">Time</span>
                              <span className="text-[11px] font-bold text-orange-900 dark:text-orange-100">{booking.start_time}{booking.end_time ? `–${booking.end_time}` : ''}</span>
                            </div>
                          </div>
                        )}
                        {booking.pending_proposal?.reason && (
                          <div className="mt-3 rounded-xl border border-orange-200 dark:border-orange-500/20 bg-white/60 dark:bg-orange-950/30 px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400 mb-1">Head's Note</p>
                            <p className="text-[11px] italic text-orange-900 dark:text-orange-100">"{booking.pending_proposal.reason}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="sm"
                        className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-[10px] tracking-widest h-10 shadow-lg shadow-orange-500/20"
                        onClick={async () => {
                          if(booking.pending_proposal) {
                            setRespondingToProposalId(booking.id);
                            await respondToProposal(booking.id, 'accept');
                            setRespondingToProposalId(null);
                          } else {
                            setRespondingToId(booking.id);
                            await respondToAlternative(booking.id, true);
                            setRespondingToId(null);
                          }
                        }}
                        disabled={respondingToId === booking.id || respondingToProposalId === booking.id}
                      >
                        {(respondingToId === booking.id || respondingToProposalId === booking.id) ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3.5 h-3.5 mr-2" />}
                        Accept Alternative
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-xl border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 font-black uppercase text-[10px] tracking-widest h-10 bg-white dark:bg-transparent hover:bg-orange-50 dark:hover:bg-orange-500/10"
                        onClick={async () => {
                          if(booking.pending_proposal) {
                            setRespondingToProposalId(booking.id);
                            await respondToProposal(booking.id, 'decline');
                            setRespondingToProposalId(null);
                          } else {
                            setRespondingToId(booking.id);
                            await respondToAlternative(booking.id, false);
                            setRespondingToId(null);
                          }
                        }}
                        disabled={respondingToId === booking.id || respondingToProposalId === booking.id}
                      >
                        <X className="w-3.5 h-3.5 mr-2" /> Decline & Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Emergency Reschedule (Building Admin proposed) */}
                {booking.current_status === 'pending_user_response' && booking.pending_proposal?.action === 'emergency_reschedule' && (
                  <div className="mb-4 p-4 rounded-xl border-2 border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/5">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-orange-900 dark:text-orange-200">Reschedule Proposed</h4>
                        <p className="text-xs text-orange-700 dark:text-orange-300/80 mt-0.5 leading-relaxed">
                          The Building Admin has proposed a new schedule due to an emergency. Please review and respond.
                        </p>
                      </div>
                    </div>
                    {booking.pending_proposal && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {booking.pending_proposal.proposed_date && (
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-orange-100 dark:border-orange-900/20">
                            <span className="block text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">New Date</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{booking.pending_proposal.proposed_date}</span>
                          </div>
                        )}
                        {(booking.pending_proposal.proposed_start_time || booking.pending_proposal.proposed_end_time) && (
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-orange-100 dark:border-orange-900/20">
                            <span className="block text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">New Time</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {booking.pending_proposal.proposed_start_time?.slice(0, 5)} – {booking.pending_proposal.proposed_end_time?.slice(0, 5)}
                            </span>
                          </div>
                        )}
                        {booking.pending_proposal.reason && (
                          <div className="sm:col-span-2 p-3 bg-orange-100/50 dark:bg-orange-500/5 rounded-lg">
                            <span className="block text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Reason</span>
                            <span className="text-xs font-medium text-orange-900 dark:text-orange-200 italic">&ldquo;{booking.pending_proposal.reason}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-orange-700 dark:text-orange-400 italic mb-3">
                      Declining will convert your payment to a session credit usable on future bookings.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        size="sm"
                        className="flex-1 font-bold shadow-sm bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={respondingId === booking.id}
                        onClick={() => respondToEmergency(booking.id, 'accept')}
                      >
                        {respondingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3 h-3 mr-2" />}
                        Accept Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 font-bold border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/10"
                        disabled={respondingId === booking.id}
                        onClick={() => respondToEmergency(booking.id, 'decline_convert_to_credit')}
                      >
                        <X className="w-3 h-3 mr-2" /> Decline
                      </Button>
                    </div>
                  </div>
                )}

                {/* On Hold */}
                {booking.current_status === 'on_hold' && (
                  <div className="mb-4 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/5">
                    <div className="flex items-start gap-3">
                      <PauseCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200">Booking On Hold</h4>
                        <p className="text-xs text-purple-700 dark:text-purple-300/80 mt-0.5 leading-relaxed">
                          Your booking is currently on hold while the administration works on a resolution. Please contact the helpdesk for updates.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Emergency Reschedule Request Section */}
                {booking.has_completed_payment && ['approved', 'auto_approved'].includes(booking.current_status) && (() => {
                  const pendingReschedule = booking.pending_reschedule_request
                  const declinedReschedule = booking.last_declined_reschedule_request
                  const showDeclined = declinedReschedule && !dismissedRescheduleDeclineIds.has(declinedReschedule.id)
                  return (
                    <div className="mb-4 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Reschedule</p>
                      </div>
                      {showDeclined && (
                        <div className="mb-3 p-3 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5">
                          <p className="text-xs font-bold text-red-700 dark:text-red-300 mb-1">Request Declined</p>
                          <p className="text-xs text-red-600 dark:text-red-400 italic mb-2">"{declinedReschedule!.review_notes ?? 'No notes.'}"</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { dismissRescheduleDecline(declinedReschedule!.id); setEmergencyBookingId(booking.id) }} className="flex-1 text-xs font-bold text-red-600 border-red-300">Request Cancellation</Button>
                            <Button size="sm" variant="ghost" onClick={() => dismissRescheduleDecline(declinedReschedule!.id)} className="flex-1 text-xs font-bold text-slate-500">Dismiss</Button>
                          </div>
                        </div>
                      )}
                      {pendingReschedule ? (
                        <div className="space-y-2">
                          <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 border border-blue-200/50 dark:border-blue-500/20 space-y-1">
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{pendingReschedule.status === 'pending_extra_payment' ? 'Awaiting Extra Payment' : 'Pending Admin Review'}</p>
                            <p className="text-xs text-blue-800 dark:text-blue-200">Proposed: {pendingReschedule.proposed_date} · {pendingReschedule.proposed_start_time?.slice(0,5)}–{pendingReschedule.proposed_end_time?.slice(0,5)}</p>
                            {pendingReschedule.extra_amount_centavos > 0 && <p className="text-xs font-bold text-amber-600">Extra: ₱{(pendingReschedule.extra_amount_centavos / 100).toFixed(2)}</p>}
                          </div>
                          {pendingReschedule.status === 'pending_extra_payment'
                            ? <Link href="/program/payment"><Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs">Pay Extra Charge</Button></Link>
                            : <Button size="sm" variant="outline" onClick={() => withdrawRescheduleRequest(booking.id)} className="w-full text-xs font-bold text-blue-600 border-blue-300">Withdraw Request</Button>
                          }
                        </div>
                      ) : !showDeclined && (
                        <Button size="sm" onClick={() => setRescheduleBookingId(booking.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20">
                          Request Reschedule
                        </Button>
                      )}
                    </div>
                  )
                })()}

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
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
                        variant="ghost"
                        size="sm"
                        onClick={() => setExtendBooking(booking)}
                        className="gap-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold"
                      >
                        <Clock className="w-4 h-4" /> Extend
                      </Button>
                    )
                  })()}
                  {(['pending', 'flagged'].includes(booking.current_status) ||
                    (['approved', 'auto_approved'].includes(booking.current_status) && !booking.has_completed_payment)) && (
                    <RequestCancellationDialog
                      bookingId={booking.id}
                      bookingDate={booking.booking_date}
                      hasCompletedPayment={booking.has_completed_payment}
                      onSuccess={refresh}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </Button>
                      }
                    />
                  )}
                  {['approved', 'auto_approved'].includes(booking.current_status) && booking.has_completed_payment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEmergencyBookingId(booking.id)}
                      className="gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-10">
              <Button
                variant="outline"
                size="sm"
                className="font-bold rounded-lg border-slate-200 dark:border-slate-800"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Page {page} <span className="opacity-30">/</span> {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-bold rounded-lg border-slate-200 dark:border-slate-800"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

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

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}