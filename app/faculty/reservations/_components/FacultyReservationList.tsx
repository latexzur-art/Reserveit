"use client"

import Link from 'next/link'
import { Calendar, Loader2, X, AlertTriangle, CheckCircle, Clock, MapPin, Hash, Info, PauseCircle, Phone } from 'lucide-react'
import { type ReservationItem } from '@/hooks/faculty/useReservations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonList } from "@/components/ui/SkeletonList";
import { FacilityWarningBannerInline } from '@/components/shared/facilities/FacilityWarningBannerInline'
import { RequestCancellationDialog } from '@/components/cancellation/RequestCancellationDialog'
import { bookingPurposeLabel, bookingStatusLabel } from '@/lib/enum-labels'


const STATUS_BADGE: Record<string, string> = {
  auto_approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  overridden: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  flagged: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  pending_faculty_response: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
  pending_user_response: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
  on_hold: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  cancellation_requested: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  cancellation_proposed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  auto_declined: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5',
  completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  awaiting_reschedule: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
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
  awaiting_reschedule: 'Awaiting Reschedule',
}

interface FacultyReservationListProps {
  filtered: ReservationItem[]
  loading: boolean
  search: string
  respondingId: string | null
  respondingToProposalId: string | null
  promptStatus: Map<string, 'loading' | 'accepted' | 'declined' | 'error'>
  helpdeskPhone: string
  dismissedRescheduleDeclineIds: Set<string>
  page: number
  totalPages: number
  onCancelSuccess: () => void
  setExtendBooking: (booking: ReservationItem | null) => void
  setEmergencyBookingId: (id: string | null) => void
  setRescheduleBookingId: (id: string | null) => void
  setRespondingToProposalId: (id: string | null) => void
  setPromptStatus: (updater: (prev: Map<string, 'loading' | 'accepted' | 'declined' | 'error'>) => Map<string, 'loading' | 'accepted' | 'declined' | 'error'>) => void
  setPage: (page: number) => void
  respondToAlternative: (bookingId: string, accept: boolean) => Promise<boolean>
  respondToProposal: (bookingId: string, action: 'accept' | 'decline') => Promise<void>
  respondToEmergency: (bookingId: string, action: 'accept' | 'decline_convert_to_credit') => void
  withdrawRescheduleRequest: (bookingId: string) => void
  dismissRescheduleDecline: (requestId: string) => void
}

export function FacultyReservationList({
  filtered,
  loading,
  search,
  respondingId,
  respondingToProposalId,
  promptStatus,
  helpdeskPhone,
  dismissedRescheduleDeclineIds,
  page,
  totalPages,
  onCancelSuccess,
  setExtendBooking,
  setEmergencyBookingId,
  setRescheduleBookingId,
  setRespondingToProposalId,
  setPromptStatus,
  setPage,
  respondToAlternative,
  respondToProposal,
  respondToEmergency,
  withdrawRescheduleRequest,
  dismissRescheduleDecline,
}: FacultyReservationListProps) {
  return (
    <div className="space-y-6">
      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-white/10 p-16 text-center">
          <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
            No Records Found
          </h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
            {search ? 'Try adjusting your search terms or filters.' : 'Your reservation history is currently empty.'}
          </p>
          <Button asChild variant="outline" className="rounded-xl font-bold uppercase text-xs tracking-wider border-slate-200 dark:border-white/10">
            <Link href="/faculty/form">Create Reservation</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(booking => (
            <div
              key={booking.id}
              className="group relative bg-white dark:bg-slate-900 p-5 md:p-7 rounded-[2rem] border border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-blue-500/5"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">

                {/* Left: Essential Details */}
                <div className="space-y-4 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tight">
                        {booking.facility_name}
                      </h3>
                    </div>
                    <Badge className={`w-fit rounded-lg px-3 py-1 font-bold text-xs uppercase tracking-wider border transition-colors ${STATUS_BADGE[booking.current_status] ?? STATUS_BADGE.pending}`}>
                      {STATUS_LABEL[booking.current_status] ?? bookingStatusLabel(booking.current_status)}
                    </Badge>
                    {booking.pending_reschedule_request && (
                      <Badge className={`w-fit rounded-lg px-3 py-1 font-bold text-xs uppercase tracking-wider border ${
                        booking.pending_reschedule_request.status === 'pending_extra_payment'
                          ? 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'
                          : 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                      }`}>
                        {booking.pending_reschedule_request.status === 'pending_extra_payment' ? 'Pending Payment' : 'Reschedule Requested'}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-y-2 gap-x-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">
                        {booking.booking_date} <span className="mx-1 opacity-30">|</span> {booking.start_time} – {booking.end_time}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs font-bold text-slate-400 uppercase">#{booking.booking_reference}</p>
                    </div>
                  </div>

                  {/* Purpose Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-slate-50 dark:border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purpose</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{booking.purpose}</p>
                    </div>
                    {booking.expected_attendees && (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{booking.expected_attendees} Pax</p>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                        {bookingPurposeLabel(booking.booking_purpose)}
                      </p>
                    </div>
                    {booking.course_code && (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Course</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {booking.course_code} — {booking.course_name}
                          {booking.is_elective && (
                            <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                              Elective: {booking.elective_type}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
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
                        className="rounded-xl font-bold uppercase text-xs tracking-wider h-10 px-4 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                      >
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        Extend
                      </Button>
                    )
                  })()}
                  {(['pending', 'flagged'].includes(booking.current_status) ||
                    (['approved', 'auto_approved'].includes(booking.current_status) && !booking.has_completed_payment)) && (
                    <RequestCancellationDialog
                      bookingId={booking.id}
                      bookingDate={booking.booking_date}
                      hasCompletedPayment={booking.has_completed_payment}
                      onSuccess={onCancelSuccess}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl font-bold uppercase text-xs tracking-wider h-10 px-4 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
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
                      className="rounded-xl font-bold uppercase text-xs tracking-wider h-10 px-4 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Contextual Alert Blocks */}
              {(booking.current_status === 'flagged' || booking.current_status === 'pending_faculty_response') && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2">

                  {/* Specialized Use Review */}
                  {booking.current_status === 'flagged' && booking.mismatch_flag === 'UNRECOGNIZED_CROSS_DEPT_USE' && (
                    <div className="flex items-start gap-4 bg-amber-50 dark:bg-amber-500/5 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20 shadow-sm shadow-amber-500/5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 mb-1">Cross-Departmental Review</p>
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300/80 leading-relaxed">
                          This booking is under review by the Academic Head. Specialized facility use outside your home department requires manual validation.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* General Admin Review */}
                  {booking.current_status === 'flagged' && booking.mismatch_flag !== 'UNRECOGNIZED_CROSS_DEPT_USE' && (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                      <Info className="w-4 h-4 text-slate-400" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Awaiting administrative audit. We&apos;ll notify you when a decision is finalized.
                      </p>
                    </div>
                  )}

                  {/* Alternative Facility Prompt */}
                  {booking.current_status === 'pending_faculty_response' && booking.mismatch_alternative_facility_id && (() => {
                    const status = promptStatus.get(booking.id)
                    if (status === 'error') return (
                      <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        <p className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">Something went wrong. Please try again.</p>
                      </div>
                    )
                    if (status === 'loading') return (
                      <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">Processing your response...</p>
                      </div>
                    )
                    if (status === 'accepted') return (
                      <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Alternative accepted. Refreshing Ledger...</p>
                      </div>
                    )
                    if (status === 'declined') return (
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/50 flex items-center gap-3 opacity-60">
                        <X className="w-5 h-5 text-slate-500" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Request Declined & Cancelled</p>
                      </div>
                    )
                    return (
                      <div className="p-6 rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/5 shadow-xl shadow-orange-500/5">
                        <div className="flex items-start gap-4 mb-5">
                          <div className="bg-orange-500 dark:bg-orange-400 rounded-lg p-2">
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
                                <p className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">Proposed alternative</p>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs uppercase tracking-wider text-orange-600/70 dark:text-orange-300/60 min-w-[60px]">Facility</span>
                                  <span className="text-xs font-bold text-orange-900 dark:text-orange-100">
                                    {booking.mismatch_alternative_facility.name}
                                    {booking.mismatch_alternative_facility.room_number ? ` (Room ${booking.mismatch_alternative_facility.room_number})` : ''}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs uppercase tracking-wider text-orange-600/70 dark:text-orange-300/60 min-w-[60px]">Date</span>
                                  <span className="text-xs font-bold text-orange-900 dark:text-orange-100">{booking.booking_date}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs uppercase tracking-wider text-orange-600/70 dark:text-orange-300/60 min-w-[60px]">Time</span>
                                  <span className="text-xs font-bold text-orange-900 dark:text-orange-100">{booking.start_time}{booking.end_time ? `–${booking.end_time}` : ''}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            size="sm"
                            className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-xs tracking-wider h-10 shadow-lg shadow-orange-500/20"
                            onClick={async () => {
                              setPromptStatus(prev => new Map(prev).set(booking.id, 'loading'))
                              const success = await respondToAlternative(booking.id, true)
                              setPromptStatus(prev => new Map(prev).set(booking.id, success ? 'accepted' : 'error'))
                            }}
                            disabled={promptStatus.get(booking.id) === 'loading'}
                          >
                            {promptStatus.get(booking.id) === 'loading' ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3.5 h-3.5 mr-2" />}
                            Accept Alternative
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-xl border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 font-black uppercase text-xs tracking-wider h-10 bg-white dark:bg-transparent hover:bg-orange-50 dark:hover:bg-orange-500/10"
                            onClick={async () => {
                              setPromptStatus(prev => new Map(prev).set(booking.id, 'loading'))
                              const success = await respondToAlternative(booking.id, false)
                              setPromptStatus(prev => new Map(prev).set(booking.id, success ? 'declined' : 'error'))
                            }}
                            disabled={promptStatus.get(booking.id) === 'loading'}
                          >
                            <X className="w-3.5 h-3.5 mr-2" />
                            Decline & Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Proposal Review Block */}
                  {booking.current_status === 'pending_faculty_response' && booking.pending_proposal && (
                    <div className="p-6 rounded-[2rem] border border-orange-200 dark:border-orange-500/30 bg-white dark:bg-slate-950 shadow-inner">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Proposed Schedule Changes</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {booking.pending_proposal.proposed_date && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">New Date</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{booking.pending_proposal.proposed_date}</span>
                          </div>
                        )}
                        {(booking.pending_proposal.proposed_start_time || booking.pending_proposal.proposed_end_time) && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">New Time Window</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {booking.pending_proposal.proposed_start_time} – {booking.pending_proposal.proposed_end_time}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-orange-50 dark:bg-orange-500/5 rounded-2xl mb-6">
                        <span className="block text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Moderator Note</span>
                        <span className="text-xs font-medium text-orange-900 dark:text-orange-200 italic">&ldquo;{booking.pending_proposal.reason}&rdquo;</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          className="flex-1 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black uppercase text-xs tracking-wider h-10 transition-transform active:scale-[0.98]"
                          onClick={async () => {
                            setRespondingToProposalId(booking.id)
                            await respondToProposal(booking.id, 'accept')
                            setRespondingToProposalId(null)
                          }}
                          disabled={respondingToProposalId === booking.id}
                        >
                          {respondingToProposalId === booking.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3.5 h-3.5 mr-2" />}
                          Accept Changes
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1 rounded-xl font-black uppercase text-xs tracking-wider h-10 shadow-lg shadow-rose-500/20"
                          onClick={async () => {
                            setRespondingToProposalId(booking.id)
                            await respondToProposal(booking.id, 'decline')
                            setRespondingToProposalId(null)
                          }}
                          disabled={respondingToProposalId === booking.id}
                        >
                          <X className="w-3.5 h-3.5 mr-2" />
                          Decline & Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Required (post-approval, awaiting user payment) */}
              {booking.current_status === 'pending_user_response' && booking.requires_payment && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                  <div className="p-6 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 shadow-sm shadow-amber-500/5">
                    <div className="flex items-start gap-4">
                      <div className="bg-amber-500 dark:bg-amber-400 rounded-lg p-2">
                        <AlertTriangle className="w-5 h-5 text-white dark:text-slate-900" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">Payment Required</p>
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300/70 mt-1 leading-relaxed">
                          Your booking has been approved. Please complete payment in your billing history to confirm your slot.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Reschedule (Building Admin) */}
              {booking.current_status === 'pending_user_response' && booking.pending_proposal?.action === 'emergency_reschedule' && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                  <div className="p-6 rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/5 shadow-xl shadow-orange-500/5">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="bg-orange-500 dark:bg-orange-400 rounded-lg p-2">
                        <AlertTriangle className="w-5 h-5 text-white dark:text-slate-900" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-orange-900 dark:text-orange-200 uppercase tracking-tight">Reschedule Proposed</p>
                        <p className="text-xs font-medium text-orange-700 dark:text-orange-300/70 mt-1 leading-relaxed">
                          The Building Admin has proposed a new schedule due to an emergency. Please review and respond.
                        </p>
                      </div>
                    </div>
                    {booking.pending_proposal && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {booking.pending_proposal.proposed_date && (
                          <div className="p-3 bg-white/60 dark:bg-slate-900 rounded-xl border border-orange-100 dark:border-white/5">
                            <span className="block text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">New Date</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{booking.pending_proposal.proposed_date}</span>
                          </div>
                        )}
                        {(booking.pending_proposal.proposed_start_time || booking.pending_proposal.proposed_end_time) && (
                          <div className="p-3 bg-white/60 dark:bg-slate-900 rounded-xl border border-orange-100 dark:border-white/5">
                            <span className="block text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">New Time Window</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {(booking.pending_proposal.proposed_start_time ?? booking.start_time)?.slice(0, 5)} – {(booking.pending_proposal.proposed_end_time ?? booking.end_time)?.slice(0, 5)}
                            </span>
                          </div>
                        )}
                        {booking.pending_proposal.reason && (
                          <div className="sm:col-span-2 p-3 bg-orange-100/50 dark:bg-orange-500/5 rounded-xl">
                            <span className="block text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Reason</span>
                            <span className="text-xs font-medium text-orange-900 dark:text-orange-200 italic">&ldquo;{booking.pending_proposal.reason}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="sm"
                        className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-xs tracking-wider h-10 shadow-lg shadow-orange-500/20"
                        disabled={respondingId === booking.id}
                        onClick={() => respondToEmergency(booking.id, 'accept')}
                      >
                        {respondingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3.5 h-3.5 mr-2" />}
                        Accept Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-xl border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 font-black uppercase text-xs tracking-wider h-10 bg-white dark:bg-transparent hover:bg-orange-50 dark:hover:bg-orange-500/10"
                        disabled={respondingId === booking.id}
                        onClick={() => respondToEmergency(booking.id, 'decline_convert_to_credit')}
                      >
                        <X className="w-3.5 h-3.5 mr-2" />
                        Decline
                      </Button>
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
                  <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Reschedule</p>
                      </div>
                      {showDeclined && (
                        <div className="mb-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">Reschedule Request Declined</p>
                          <p className="text-xs text-rose-700 dark:text-rose-300 italic mb-2">&ldquo;{declinedReschedule!.review_notes ?? 'No notes.'}&rdquo;</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { dismissRescheduleDecline(declinedReschedule!.id); setEmergencyBookingId(booking.id) }} className="flex-1 border-rose-300 text-rose-600 rounded-xl text-xs font-bold uppercase tracking-wider">Request Cancellation</Button>
                            <Button size="sm" variant="ghost" onClick={() => dismissRescheduleDecline(declinedReschedule!.id)} className="flex-1 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider">Dismiss</Button>
                          </div>
                        </div>
                      )}
                      {pendingReschedule ? (
                        <div className="space-y-2">
                          <div className="bg-white/60 dark:bg-black/20 px-3 py-2 rounded-xl border border-blue-200/50 dark:border-blue-500/20 space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{pendingReschedule.status === 'pending_extra_payment' ? 'Awaiting Extra Payment' : 'Pending Admin Review'}</p>
                            <p className="text-xs text-blue-800 dark:text-blue-200">Proposed: {pendingReschedule.proposed_date} · {pendingReschedule.proposed_start_time?.slice(0,5)}–{pendingReschedule.proposed_end_time?.slice(0,5)}</p>
                            {pendingReschedule.extra_amount_centavos > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">Extra: ₱{(pendingReschedule.extra_amount_centavos / 100).toFixed(2)}</p>}
                          </div>
                          {pendingReschedule.status === 'pending_extra_payment' ? (
                            <Link href="/faculty/payment"><Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider"><Clock className="w-3 h-3 mr-2" />Pay Extra Charge</Button></Link>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => withdrawRescheduleRequest(booking.id)} className="w-full border-blue-300 text-blue-600 rounded-xl text-xs font-bold uppercase tracking-wider">Withdraw Reschedule Request</Button>
                          )}
                        </div>
                      ) : !showDeclined && (
                        <Button size="sm" onClick={() => setRescheduleBookingId(booking.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-500/20">
                          <AlertTriangle className="w-3 h-3 mr-2" />Request Reschedule
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* On Hold (Helpdesk Contact) */}
              {booking.current_status === 'on_hold' && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                  <div className="p-6 rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/5 shadow-sm shadow-purple-500/5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="bg-purple-500 dark:bg-purple-400 rounded-lg p-2">
                        <PauseCircle className="w-5 h-5 text-white dark:text-slate-900" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-purple-900 dark:text-purple-200 uppercase tracking-tight">Booking On Hold</p>
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-300/70 mt-1 leading-relaxed">
                          Your booking is currently on hold while we discuss next steps. Please reach out to our helpdesk.
                        </p>
                      </div>
                    </div>
                    {helpdeskPhone && (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-purple-200 dark:border-purple-500/20">
                        <Phone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-black text-purple-900 dark:text-purple-200 tracking-wide">
                          {helpdeskPhone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Facility Warning */}
              {booking.facility_id && (
                <div className="mt-4">
                  <FacilityWarningBannerInline facilityId={booking.facility_id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-10 pb-20">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-xl font-bold uppercase text-xs tracking-wider px-5 border-slate-200 dark:border-white/10"
          >
            Prev
          </Button>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black">
              {page}
            </span>
            <span className="text-xs font-black text-slate-400 uppercase">/ {totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-xl font-bold uppercase text-xs tracking-wider px-5 border-slate-200 dark:border-white/10"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
