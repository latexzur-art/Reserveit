"use client"

import Link from 'next/link'
import { Calendar, Loader2, Clock, CreditCard, AlertTriangle, PauseCircle, Phone, Mail, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import type { ReservationItem } from '@/hooks/faculty/useReservations'
import { RequestCancellationDialog } from '@/components/cancellation/RequestCancellationDialog'
import { bookingStatusLabel } from '@/lib/enum-labels'
import { isRefundWindowMet, getManilaDateString } from '@/lib/refund-eligibility'

export const STATUS_BADGE: Record<string, string> = {
  approved:               'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  auto_approved:          'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  pending:                'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20',
  flagged:                'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20',
  pending_user_response:  'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/20',
  on_hold:                'bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/20',
  cancellation_requested: 'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/20',
  cancellation_proposed:  'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20',
  auto_declined:          'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  rejected:               'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  awaiting_reschedule:    'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  cancelled:              'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  completed:              'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20',
}

export const STATUS_LABEL: Record<string, string> = {
  approved:               'Approved',
  auto_approved:          'Approved',
  pending:                'Pending Approval',
  flagged:                'Under Review',
  pending_user_response:  'Action Required',
  on_hold:                'On Hold',
  cancellation_requested: 'Cancel Requested',
  cancellation_proposed:  'Cancellation Proposed',
  auto_declined:          'Declined',
  rejected:               'Declined',
  awaiting_reschedule:    'Awaiting Reschedule',
  cancelled:              'Cancelled',
  completed:              'Completed',
}

export const PAYMENT_PENDING_STATUSES = ['approved', 'auto_approved', 'pending_user_response']

interface BookingCardProps {
  b: ReservationItem
  helpdeskPhone: string
  helpdeskEmail: string
  respondingId: string | null
  dismissedDenialIds: Set<string>
  dismissedRescheduleDeclineIds: Set<string>
  onCancelSuccess: () => void
  onEmergencyRequest: (id: string) => void
  onRescheduleRequest: (id: string) => void
  onCancellationProposalResponse: (bookingId: string, action: 'accept' | 'dispute', destinationName?: string, destinationContact?: string) => void
  dismissDenial: (requestId: string) => void
  dismissRescheduleDecline: (requestId: string) => void
  withdrawEmergencyRequest: (id: string) => void
  withdrawRescheduleRequest: (id: string) => void
  respondToEmergency: (id: string, action: 'accept' | 'decline_convert_to_credit') => void
}

export function BookingCard({
  b,
  helpdeskPhone,
  helpdeskEmail,
  respondingId,
  dismissedDenialIds,
  dismissedRescheduleDeclineIds,
  onCancelSuccess,
  onEmergencyRequest,
  onRescheduleRequest,
  onCancellationProposalResponse,
  dismissDenial,
  dismissRescheduleDecline,
  withdrawEmergencyRequest,
  withdrawRescheduleRequest,
  respondToEmergency,
}: BookingCardProps) {
  const needsPayment = PAYMENT_PENDING_STATUSES.includes(b.current_status) && b.requires_payment
  return (

                  <div className="group bg-card rounded-xl border border-border/80 p-5 shadow-xs hover:border-border hover:shadow-sm transition-all duration-200">
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-black tracking-tight text-sti-navy dark:text-white uppercase">
                            #{b.booking_reference}
                          </span>
                          <Badge className={cn("rounded-lg font-bold uppercase text-xs tracking-wider px-2.5 py-1 border", STATUS_BADGE[b.current_status])}>
                            {STATUS_LABEL[b.current_status] ?? bookingStatusLabel(b.current_status)}
                          </Badge>
                          {b.pending_reschedule_request && (
                            <Badge className={cn(
                              "rounded-lg font-bold uppercase text-xs tracking-wider px-2.5 py-1 border",
                              b.pending_reschedule_request.status === 'pending_extra_payment'
                                ? 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300'
                                : 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300'
                            )}>
                              {b.pending_reschedule_request.status === 'pending_extra_payment' ? 'Pending Payment' : 'Reschedule Requested'}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <span className="text-accent-brand font-extrabold">{b.facility_name}</span>
                            <span className="opacity-40">•</span>
                            {b.booking_date}
                          </p>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                            {b.start_time} – {b.end_time}
                          </p>
                        </div>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-1 max-w-md">
                          "{b.purpose}"
                        </p>

                        {b.course_code && (
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                            Course: {b.course_code} — {b.course_name}
                            {b.is_elective && (
                              <span className="ml-2 text-accent-brand font-bold">Elective: {b.elective_type}</span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {needsPayment && b.current_status !== 'pending_user_response' && (
                          <Link href={ROUTES.client.payment}>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider px-6 w-full shadow-md shadow-red-500/20">
                              <CreditCard className="w-3.5 h-3.5 mr-2" /> Pay Now
                            </Button>
                          </Link>
                        )}
                        
                        {(['pending', 'flagged'].includes(b.current_status) && !b.has_completed_payment) && (
                          <RequestCancellationDialog
                            bookingId={b.id}
                            bookingDate={b.booking_date}
                            hasCompletedPayment={b.has_completed_payment}
                            onSuccess={onCancelSuccess}
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl font-bold uppercase text-xs tracking-wider px-6"
                              >
                                Cancel Request
                              </Button>
                            }
                          />
                        )}
                        {['approved', 'auto_approved', 'pending_user_response'].includes(b.current_status) && !b.has_completed_payment && (
                          <RequestCancellationDialog
                            bookingId={b.id}
                            bookingDate={b.booking_date}
                            hasCompletedPayment={b.has_completed_payment}
                            onSuccess={onCancelSuccess}
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl font-bold uppercase text-xs tracking-wider px-6"
                              >
                                Cancel
                              </Button>
                            }
                          />
                        )}
                        {['approved', 'auto_approved'].includes(b.current_status) && b.has_completed_payment && (
                          <RequestCancellationDialog
                            bookingId={b.id}
                            bookingDate={b.booking_date}
                            hasCompletedPayment={b.has_completed_payment}
                            onSuccess={onCancelSuccess}
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl font-bold uppercase text-xs tracking-wider px-6"
                              >
                                Cancel
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </div>

                    {/* Desktop Contextual Banners */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {needsPayment && b.current_status !== 'pending_user_response' && (
                        <div className="flex items-center gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-amber-500/20">
                          <CreditCard size={14} /> Payment Required to secure slot
                        </div>
                      )}
                      {b.current_status === 'pending' && (
                        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-blue-500/20">
                          <Clock size={14} /> Awaiting admin review
                        </div>
                      )}
                    </div>

                    {/* Cancellation/refund banner for active paid bookings */}
                    {b.has_completed_payment && ['approved', 'auto_approved'].includes(b.current_status) && (() => {
                      const refundWindowOpen = isRefundWindowMet(b.booking_date, getManilaDateString())
                      const hasPendingReq = !!b.pending_emergency_request
                      const deniedReq = b.last_denied_emergency_request
                      const showDenied = deniedReq && !dismissedDenialIds.has(deniedReq.id)

                      // Refund-eligible: within the 2-day refund window
                      if (refundWindowOpen) {
                        return (
                          <div className="mt-4 p-4 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                              <p className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                                Refund-Eligible Reservation
                              </p>
                            </div>
                            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed mb-3">
                              This booking is within the refund window. You'll receive a full refund if your cancellation is approved.
                            </p>
                            <RequestCancellationDialog
                              bookingId={b.id}
                              bookingDate={b.booking_date}
                              hasCompletedPayment
                              onSuccess={onCancelSuccess}
                              trigger={
                                <Button
                                  size="sm"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs"
                                >
                                  Request Cancellation
                                </Button>
                              }
                            />
                          </div>
                        )
                      }

                      // Non-refundable: outside the 2-day refund window
                      return (
                        <div className="mt-4 p-4 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                            <p className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300 tracking-wider">
                              Non-Refundable Reservation
                            </p>
                          </div>
                          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed mb-3">
                            Reservations are non-refundable. For extreme emergencies or facility unavailability, contact our Helpdesk:
                          </p>
                          <div className="flex flex-col gap-1.5 mb-4">
                            {helpdeskPhone && (
                              <div className="flex items-center gap-2 bg-background/80 dark:bg-black/20 px-3 py-2 rounded-lg border border-amber-500/20">
                                <Phone className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                                <span className="text-xs font-bold text-amber-900 dark:text-amber-100 tracking-wider">{helpdeskPhone}</span>
                              </div>
                            )}
                            {helpdeskEmail && (
                              <div className="flex items-center gap-2 bg-background/80 dark:bg-black/20 px-3 py-2 rounded-lg border border-amber-500/20">
                                <Mail className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                                <span className="text-xs font-bold text-amber-900 dark:text-amber-100 tracking-wider">{helpdeskEmail}</span>
                              </div>
                            )}
                          </div>

                          {/* Denied state */}
                          {showDenied && (
                            <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300 mb-1">Previous Request Denied</p>
                              <p className="text-xs text-red-700 dark:text-red-300 italic">"{deniedReq!.review_notes ?? 'No additional notes.'}"</p>
                            </div>
                          )}

                          {/* Request button or pending state */}
                          {hasPendingReq ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 bg-background/80 dark:bg-black/20 px-3 py-2 rounded-lg border border-amber-500/20">
                                <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                                <span className="text-xs text-amber-800 dark:text-amber-200 font-medium">Emergency cancellation request pending admin review.</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => withdrawEmergencyRequest(b.id)}
                                className="w-full border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-amber-50 dark:hover:bg-amber-500/10"
                              >
                                Withdraw Request
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                if (showDenied) dismissDenial(deniedReq!.id)
                                onEmergencyRequest(b.id)
                              }}
                              className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                              Request Emergency Cancellation
                            </Button>
                          )}
                        </div>
                      )
                    })()}

                    {/* Emergency Reschedule Request Section */}
                    {b.has_completed_payment && ['approved', 'auto_approved'].includes(b.current_status) && (() => {
                      const pendingReschedule = b.pending_reschedule_request
                      const declinedReschedule = b.last_declined_reschedule_request
                      const showDeclined = declinedReschedule && !dismissedRescheduleDeclineIds.has(declinedReschedule.id)

                      return (
                        <div className="mt-3 p-4 bg-blue-500/5 dark:bg-blue-500/10 rounded-xl border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                            <p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-300 tracking-wider">
                              Reschedule
                            </p>
                          </div>

                          {/* Declined state */}
                          {showDeclined && (
                            <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300 mb-1">Reschedule Request Declined</p>
                              <p className="text-xs text-red-700 dark:text-red-300 italic mb-2">"{declinedReschedule!.review_notes ?? 'No additional notes.'}"</p>
                              <p className="text-xs text-red-700 dark:text-red-300 mb-2 font-medium">Your booking remains active. You may request cancellation if needed.</p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { dismissRescheduleDecline(declinedReschedule!.id); onEmergencyRequest(b.id) }}
                                  className="flex-1 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  Request Cancellation
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => dismissRescheduleDecline(declinedReschedule!.id)}
                                  className="flex-1 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold uppercase tracking-wider"
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Pending reschedule state */}
                          {pendingReschedule ? (
                            <div className="space-y-2">
                              <div className="bg-background/80 dark:bg-black/20 px-3 py-2 rounded-lg border border-blue-500/20 space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                  {pendingReschedule.status === 'pending_extra_payment' ? 'Awaiting Extra Payment' : 'Pending Admin Review'}
                                </p>
                                <p className="text-xs text-blue-900 dark:text-blue-200 font-medium">
                                  Proposed: {pendingReschedule.proposed_date} · {pendingReschedule.proposed_start_time?.slice(0,5)}–{pendingReschedule.proposed_end_time?.slice(0,5)}
                                </p>
                                {pendingReschedule.extra_amount_centavos > 0 && (
                                  <p className="text-xs text-amber-700 dark:text-amber-300 font-bold">
                                    Extra charge: ₱{(pendingReschedule.extra_amount_centavos / 100).toFixed(2)}
                                  </p>
                                )}
                              </div>
                              {pendingReschedule.status === 'pending_extra_payment' ? (
                                <Link href={ROUTES.client.payment}>
                                  <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs">
                                    <CreditCard className="w-3.5 h-3.5 mr-2" /> Pay Extra Charge
                                  </Button>
                                </Link>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => withdrawRescheduleRequest(b.id)}
                                  className="w-full border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                >
                                  Withdraw Reschedule Request
                                </Button>
                              )}
                            </div>
                          ) : !showDeclined && (
                            <Button
                              size="sm"
                              onClick={() => onRescheduleRequest(b.id)}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                              Request Reschedule
                            </Button>
                          )}
                        </div>
                      )
                    })()}

                    {/* Payment Awaiting — pending_user_response + requires_payment */}
                    {b.current_status === 'pending_user_response' && b.requires_payment && (
                      <div className="mt-4 p-4 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                          <p className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300 tracking-wider">
                            Payment Required
                          </p>
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mb-3 leading-relaxed">
                          Your booking has been approved. Please complete payment in your billing history to confirm your slot.
                        </p>
                        <Link href={ROUTES.client.payment}>
                          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider w-full shadow-xs">
                            <CreditCard className="w-3.5 h-3.5 mr-2" /> Pay Now
                          </Button>
                        </Link>
                      </div>
                    )}

                    {/* Awaiting Reschedule — Cancel Option */}
                    {b.current_status === 'awaiting_reschedule' && (
                      <div className="mt-4 p-4 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-300" />
                          <p className="text-xs font-bold uppercase text-cyan-800 dark:text-cyan-300 tracking-wider">
                            Reschedule in Progress
                          </p>
                        </div>
                        <p className="text-xs text-cyan-800 dark:text-cyan-300 mb-3 leading-relaxed">
                          Your booking was rescheduled by the Building Admin due to a school event. If you cannot make the new schedule, you may cancel this booking.
                        </p>
                        <RequestCancellationDialog
                          bookingId={b.id}
                          bookingDate={b.booking_date}
                          hasCompletedPayment={b.has_completed_payment}
                          defaultReason="Cancelled due to schedule conflict — unable to attend the Building Admin's rescheduled date for this booking."
                          dialogDescription="Your booking was rescheduled by the Building Admin. Confirm below to cancel this booking. If you have a completed payment, a refund request will be submitted."
                          onSuccess={onCancelSuccess}
                          trigger={
                            <Button
                              size="sm"
                              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs"
                            >
                              Cancel Booking
                            </Button>
                          }
                        />
                      </div>
                    )}

                    {/* Emergency Reschedule — Action Required */}
                    {b.current_status === 'pending_user_response' && b.pending_proposal?.action === 'emergency_reschedule' && (
                      <div className="mt-4 p-4 bg-orange-500/5 dark:bg-orange-500/10 rounded-xl border border-orange-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-700 dark:text-orange-300" />
                          <p className="text-xs font-bold uppercase text-orange-800 dark:text-orange-300 tracking-wider">
                            Reschedule Proposed
                          </p>
                        </div>
                        {b.pending_proposal && (
                          <div className="mb-3 bg-background/80 dark:bg-black/20 rounded-lg p-3 border border-orange-500/20">
                            <p className="text-xs font-bold uppercase text-orange-700 dark:text-orange-300 tracking-wider mb-1">Proposed Schedule</p>
                            <p className="text-xs font-bold text-orange-900 dark:text-orange-100">
                              {b.pending_proposal.proposed_date} · {b.pending_proposal.proposed_start_time?.slice(0, 5)} – {b.pending_proposal.proposed_end_time?.slice(0, 5)}
                            </p>
                            {b.pending_proposal.reason && (
                              <p className="text-xs text-orange-800 dark:text-orange-200 mt-2 italic leading-relaxed">
                                "{b.pending_proposal.reason}"
                              </p>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-orange-800 dark:text-orange-300 mb-3 leading-relaxed">
                          The Building Admin has proposed a new schedule due to an emergency. Please review and respond.
                        </p>
                        <p className="text-xs italic text-orange-700 dark:text-orange-300 mb-2">
                          Declining returns your full payment as session credit, usable on any future paid booking.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={respondingId === b.id}
                            onClick={() => respondToEmergency(b.id, 'accept')}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-lg flex-1 text-xs font-bold uppercase tracking-wider"
                          >
                            {respondingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Accept Reschedule'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={respondingId === b.id}
                            onClick={() => respondToEmergency(b.id, 'decline_convert_to_credit')}
                            className="border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg flex-1 text-xs font-bold uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            Decline & Convert to Credit
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Cancellation Proposed by BA */}
                    {b.current_status === 'cancellation_proposed' && b.cancellation_proposal && (
                      <div className="mt-4 p-4 bg-rose-500/5 dark:bg-rose-500/10 rounded-xl border border-rose-500/20 space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
                          <p className="text-xs font-bold uppercase text-rose-800 dark:text-rose-300 tracking-wider">
                            Cancellation Proposed by Building Admin
                          </p>
                        </div>
                        <div className="bg-background/80 dark:bg-black/20 rounded-lg p-3 border border-rose-500/20 space-y-1">
                          <p className="text-xs font-bold text-rose-900 dark:text-rose-100">
                            Refund: ₱{(b.cancellation_proposal.refund_amount_centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-rose-700 dark:text-rose-300 italic">
                            "{b.cancellation_proposal.reason}"
                          </p>
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-300">
                          If you accept, you will be asked to provide your refund destination details. If you dispute, the admin will contact you.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => onCancellationProposalResponse(b.id, 'accept')}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                          >
                            Accept & Provide Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCancellationProposalResponse(b.id, 'dispute')}
                            className="flex-1 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            Dispute
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* On Hold — Helpdesk Info */}
                    {b.current_status === 'on_hold' && (
                      <div className="mt-4 p-4 bg-purple-500/5 dark:bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <PauseCircle className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                          <p className="text-xs font-bold uppercase text-purple-800 dark:text-purple-300 tracking-wider">
                            Booking On Hold
                          </p>
                        </div>
                        <p className="text-xs text-purple-800 dark:text-purple-300 mb-3 leading-relaxed">
                          Your booking is currently on hold while we discuss next steps. Please reach out to our helpdesk.
                        </p>
                        {helpdeskPhone && (
                          <div className="flex items-center gap-2 bg-background/80 dark:bg-black/20 px-3 py-2 rounded-lg border border-purple-500/20">
                            <Phone className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                            <span className="text-xs font-bold text-purple-900 dark:text-purple-100 tracking-wider">
                              {helpdeskPhone}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
  )
}
