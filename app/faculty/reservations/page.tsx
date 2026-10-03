"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Plus, CalendarClock } from 'lucide-react'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { useReservations, type ReservationItem } from '@/hooks/faculty/useReservations'
import { Button } from '@/components/ui/button'
import { ExtendBookingModal } from '@/components/bookings/ExtendBookingModal'
import { RequestEmergencyCancellationModal } from '@/components/bookings/RequestEmergencyCancellationModal'
import { RequestRescheduleModal } from '@/components/bookings/RequestRescheduleModal'
import { FacultyReservationList } from './_components/FacultyReservationList'
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
  const [respondingToProposalId, setRespondingToProposalId] = useState<string | null>(null)
  const [promptStatus, setPromptStatus] = useState<Map<string, 'loading' | 'accepted' | 'declined' | 'error'>>(new Map())
  const [extendBooking, setExtendBooking] = useState<ReservationItem | null>(null)
  const [helpdeskPhone, setHelpdeskPhone] = useState<string>('')
  const [helpdeskEmail, setHelpdeskEmail] = useState<string>('')
  const [emergencyBookingId, setEmergencyBookingId] = useState<string | null>(null)
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null)
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

  const needsHelpdeskInfo = bookings.some(
    b => b.current_status === 'pending_user_response' ||
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

  const awaitingReschedule = bookings.filter(b => b.current_status === 'awaiting_reschedule')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <ConnectedTopBar title="My Reservations" breadcrumbs={[{ label: 'Dashboard' }]} />

      <main className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">

        <div className="mb-6"><UnreviewedBookingsPanel /></div>

        {/* Awaiting Reschedule Banner */}
        {awaitingReschedule.length > 0 && (
          <div className="mb-6 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CalendarClock className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
                  {awaitingReschedule.length} reservation{awaitingReschedule.length > 1 ? 's require' : ' requires'} rescheduling
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                  A school event displaced your booking{awaitingReschedule.length > 1 ? 's' : ''}. Click below to pick a new slot before the deadline.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {awaitingReschedule.slice(0, 3).map(b => (
                <Link
                  key={b.id}
                  href={`/reservations/reschedule/${b.id}`}
                  className="text-xs font-semibold text-orange-700 dark:text-orange-300 underline underline-offset-2 hover:text-orange-900 whitespace-nowrap"
                >
                  Reschedule {b.booking_reference || 'booking'}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Booking <span className="text-accent-brand">Ledger</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
              Track and manage {total} total reservations
            </p>
          </div>
          <Button asChild className="rounded-xl font-bold uppercase text-xs tracking-wider h-11 px-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95">
            <Link href="/faculty/form">
              <Plus className="w-4 h-4 mr-2" />
              New Reservation
            </Link>
          </Button>
        </div>

        {/* Filters and Search Hub */}
        <div className="bg-white dark:bg-slate-900 p-2 md:p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm mb-10">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative group">
              <label htmlFor="reservation-search" className="sr-only">Search reservations</label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
              <input
                id="reservation-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by facility, reference, or purpose..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border-transparent focus:bg-white dark:focus:bg-slate-900 border focus:border-blue-500/50 rounded-2xl text-sm transition-all text-slate-900 dark:text-white outline-none"
              />
            </div>

            {/* Scrollable Status Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 px-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  aria-pressed={statusFilter === opt.value}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    statusFilter === opt.value
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <FacultyReservationList
          filtered={filtered}
          loading={loading}
          search={search}
          respondingId={respondingId}
          respondingToProposalId={respondingToProposalId}
          promptStatus={promptStatus}
          helpdeskPhone={helpdeskPhone}
          dismissedRescheduleDeclineIds={dismissedRescheduleDeclineIds}
          page={page}
          totalPages={totalPages}
          onCancelSuccess={refresh}
          setExtendBooking={setExtendBooking}
          setEmergencyBookingId={setEmergencyBookingId}
          setRescheduleBookingId={setRescheduleBookingId}
          setRespondingToProposalId={setRespondingToProposalId}
          setPromptStatus={setPromptStatus}
          setPage={setPage}
          respondToAlternative={respondToAlternative}
          respondToProposal={respondToProposal}
          respondToEmergency={respondToEmergency}
          withdrawRescheduleRequest={withdrawRescheduleRequest}
          dismissRescheduleDecline={dismissRescheduleDecline}
        />
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

      {/* Extend Booking Modal */}
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
    </div>
  )
}
