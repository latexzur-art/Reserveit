'use client'

import {
  Calendar, Clock, MapPin, User, Mail, Info,
  CheckCircle2, XCircle, History, FileText, Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BookingCreditHistory } from './BookingCreditHistory'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { BuildingBooking } from '@/backend/admin/building/building.types'
import { approvalStatusLabel, bookingTypeLabel, paymentStatusLabel } from '@/lib/enum-labels'

/** Read-only info sections of the booking detail drawer (core, requester,
 *  purpose/logistics, decision history). */
export function BookingInfoSections({
  booking,
  isPaidBooking,
}: {
  booking: BuildingBooking
  isPaidBooking: boolean
}) {
  const facilitiesList = (booking.facilities && Array.isArray(booking.facilities) && booking.facilities.length > 0)
    ? booking.facilities
    : (booking as any).facilityName
      ? [{ name: (booking as any).facilityName, roomNumber: (booking as any).roomNumber ?? (booking as any).room_number ?? null }]
      : []

  const decisionsList = booking.decisions ?? []

  return (
    <>
            {/* CORE DETAILS */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="w-3 h-3" /> Core Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Date</span>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Calendar className="w-3.5 h-3.5 text-[#0072bc]" />
                    {booking.bookingDate}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Schedule</span>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-[#0072bc]" />
                    {booking.startTime} - {booking.endTime}
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Facility</span>
                  <div className="flex flex-wrap gap-2">
                    {facilitiesList.length > 0 ? (
                      facilitiesList.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-muted/50 px-2 py-1 rounded-lg text-xs font-bold border border-border/40">
                          <MapPin className="w-3.5 h-3.5 text-[#0072bc]" />
                          {f.name} {f.roomNumber && `(${f.roomNumber})`}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <Separator className="bg-border/40" />

            {/* REQUESTER INFO */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <User className="w-3 h-3" /> Requester Information
              </h3>
              <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0072bc]/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#0072bc]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{booking.requesterName}</p>
                    <Badge variant="secondary" className="text-[10px] font-semibold mt-0.5 border-0">
                      {bookingTypeLabel(booking.bookingType)}
                    </Badge>
                  </div>
                </div>
                {booking.requesterEmail && (
                  <div className="flex items-center gap-2 px-1 pt-1 border-t border-border/40">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground font-mono">{booking.requesterEmail?.toLowerCase()}</span>
                  </div>
                )}
              </div>
            </section>

            <Separator className="bg-border/40" />

            {/* PURPOSE & LOGISTICS */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Info className="w-3 h-3" /> Logistics & Purpose
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Purpose</span>
                  <p className="text-xs font-medium leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/20 italic text-muted-foreground">
                    "{booking.purpose}"
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Attendees</span>
                    <div className="text-xs font-bold">{booking.expectedAttendees || 'N/A'}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Facilitator</span>
                    <div className="text-xs font-bold">
                      {booking.selfFacilitationConfirmed
                        ? 'Self (Building Head)'
                        : booking.facilitatorName || booking.requesterName}
                    </div>
                  </div>
                </div>
                {booking.courseCode && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Course</span>
                    <div className="text-xs font-bold">
                      {booking.courseCode} — {booking.courseName}
                      {booking.isElective && (
                        <Badge variant="outline" className="ml-2 text-[9px] font-black uppercase border-blue-200 bg-blue-50 text-blue-700">
                          Elective: {booking.electiveType}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Payment</span>
                  <div className="flex items-center gap-1.5">
                    {booking.requiresPayment ? (
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-amber-200 bg-amber-50 text-amber-700">Required</Badge>
                    ) : isPaidBooking ? (
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-emerald-200 bg-emerald-50 text-emerald-700">Paid</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-emerald-200 bg-emerald-50 text-emerald-700">Not Required</Badge>
                    )}
                    {booking.paymentStatus && (
                      <Badge variant="outline" className="text-[9px] font-black uppercase">{paymentStatusLabel(booking.paymentStatus)}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {isPaidBooking && (
              <>
                <Separator className="bg-border/40" />
                <section className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-3 h-3" /> Credit History
                  </h3>
                  <BookingCreditHistory bookingId={booking.id} />
                </section>
              </>
            )}

            <Separator className="bg-border/40" />

            {/* DECISION HISTORY */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <History className="w-3 h-3" /> Decision History
              </h3>
              <div className="space-y-3">
                {decisionsList.length === 0 ? (
                  <p className="text-[10px] font-bold text-muted-foreground uppercase italic text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                    No decisions recorded yet
                  </p>
                ) : (
                  decisionsList.map((d) => (
                    <div key={d.id} className="relative pl-6 border-l-2 border-border/60 pb-4 last:pb-0">
                      <div className={cn(
                        "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center",
                        d.decision === 'approved' ? "bg-emerald-500" : d.decision === 'rejected' ? "bg-red-500" : "bg-amber-500"
                      )}>
                        {d.decision === 'approved' ? <CheckCircle2 className="w-2.5 h-2.5 text-white" /> : <XCircle className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-foreground">{approvalStatusLabel(d.decision)}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(new Date(d.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium leading-tight">{d.decisionReason}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
    </>
  )
}
