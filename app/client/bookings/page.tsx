"use client"

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus, Calendar } from 'lucide-react'
import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { BookingCard } from './_components/BookingCard'
import { useReservations } from '@/hooks/faculty/useReservations'
import { RequestEmergencyCancellationModal } from '@/components/bookings/RequestEmergencyCancellationModal'
import { RequestRescheduleModal } from '@/components/bookings/RequestRescheduleModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { SkeletonList } from "@/components/ui/SkeletonList"
import { UnreviewedBookingsPanel } from '@/components/shared/facilities/UnreviewedBookingsPanel'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved,auto_approved', label: 'Approved' },
  { value: 'pending_user_response', label: 'Action Required' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'awaiting_reschedule', label: 'Awaiting Reschedule' },
  { value: 'cancellation_requested', label: 'Cancel Requested' },
  { value: 'auto_declined,rejected', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
]

export default function ClientBookingsPage() {
  const {
    bookings, total, page, setPage, totalPages, statusFilter, setStatusFilter,
    loading, respondToEmergency, submitEmergencyRequest,
    withdrawEmergencyRequest, submitRescheduleRequest, withdrawRescheduleRequest, respondingId,
    refresh,
  } = useReservations()
  const [search, setSearch] = useState('')
  const [helpdeskPhone, setHelpdeskPhone] = useState<string>('')
  const [helpdeskEmail, setHelpdeskEmail] = useState<string>('')
  const [emergencyRequestBookingId, setEmergencyRequestBookingId] = useState<string | null>(null)
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null)
  const [cancelProposalAcceptId, setCancelProposalAcceptId] = useState<string | null>(null)
  const [cancelDestName, setCancelDestName] = useState('')
  const [cancelDestContact, setCancelDestContact] = useState('')
  const [dismissedDenialIds, setDismissedDenialIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('dismissed_denial_request_ids') ?? '[]'))
    } catch { return new Set() }
  })
  const [dismissedRescheduleDeclineIds, setDismissedRescheduleDeclineIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('dismissed_reschedule_decline_ids') ?? '[]'))
    } catch { return new Set() }
  })

  const handleCancellationProposalResponse = async (bookingId: string, action: 'accept' | 'dispute', destName?: string, destContact?: string) => {
    if (action === 'accept' && (!destName || !destContact)) {
      setCancelProposalAcceptId(bookingId)
      setCancelDestName('')
      setCancelDestContact('')
      return
    }
    const body: Record<string, string> = { action }
    if (action === 'accept') {
      body.destination_name = destName!
      body.destination_contact_number = destContact!
    }
    const res = await fetch(`/api/bookings/${bookingId}/cancellation-proposal/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setCancelProposalAcceptId(null)
      refresh()
    }
  }

  const needsHelpdeskInfo = bookings.some(
    b => b.current_status === 'pending_user_response' ||
         b.current_status === 'on_hold' ||
         (b.has_completed_payment && ['approved', 'auto_approved'].includes(b.current_status))
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

  const dismissDenial = (requestId: string) => {
    setDismissedDenialIds(prev => {
      const next = new Set(prev)
      next.add(requestId)
      try { localStorage.setItem('dismissed_denial_request_ids', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const dismissRescheduleDecline = (requestId: string) => {
    setDismissedRescheduleDeclineIds(prev => {
      const next = new Set(prev)
      next.add(requestId)
      try { localStorage.setItem('dismissed_reschedule_decline_ids', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const emergencyRequestBooking = emergencyRequestBookingId
    ? bookings.find(b => b.id === emergencyRequestBookingId) ?? null
    : null

  const rescheduleBooking = rescheduleBookingId
    ? bookings.find(b => b.id === rescheduleBookingId) ?? null
    : null

  const filtered = useMemo(() => {
    if (!search) return bookings
    const q = search.toLowerCase()
    return bookings.filter(b =>
      b.facility_name.toLowerCase().includes(q) ||
      b.booking_reference.toLowerCase().includes(q) ||
      b.purpose.toLowerCase().includes(q)
    )
  }, [bookings, search])

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="My Bookings" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />

      <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 pb-24">
        <UnreviewedBookingsPanel />

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
              MY <span className="text-accent-brand">BOOKINGS</span>
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              Showing {filtered.length} of {total} total requests
            </p>
          </div>

          <Button asChild className="rounded-xl h-10 px-4 text-xs font-semibold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-all">
            <Link href={ROUTES.client.booking}>
              <Plus className="w-4 h-4 mr-1.5" /> New Booking
            </Link>
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by reference, facility name, or purpose..."
              aria-label="Search bookings"
              className="w-full h-11 pl-9.5 pr-4 bg-background border border-input rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground"
            />
          </div>

          <div role="tablist" aria-label="Booking status filters" className="flex items-center gap-1 overflow-x-auto pb-1 p-1 bg-muted/40 border border-border/60 rounded-xl">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                role="tab"
                aria-selected={statusFilter === opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === opt.value
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {loading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/80 p-12 text-center shadow-xs">
              <Calendar className="w-10 h-10 text-muted-foreground opacity-40 mx-auto mb-3" />
              <p className="text-xs font-medium text-muted-foreground mb-4">No bookings found matching your search or filters</p>
              <Button asChild className="rounded-xl h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground shadow-xs">
                <Link href={ROUTES.client.booking}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Make a Booking
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map(b => (
                <BookingCard
                  key={b.id}
                  b={b}
                  helpdeskPhone={helpdeskPhone}
                  helpdeskEmail={helpdeskEmail}
                  respondingId={respondingId}
                  dismissedDenialIds={dismissedDenialIds}
                  dismissedRescheduleDeclineIds={dismissedRescheduleDeclineIds}
                  onCancelSuccess={refresh}
                  onEmergencyRequest={setEmergencyRequestBookingId}
                  onRescheduleRequest={setRescheduleBookingId}
                  onCancellationProposalResponse={handleCancellationProposalResponse}
                  dismissDenial={dismissDenial}
                  dismissRescheduleDecline={dismissRescheduleDecline}
                  withdrawEmergencyRequest={withdrawEmergencyRequest}
                  withdrawRescheduleRequest={withdrawRescheduleRequest}
                  respondToEmergency={respondToEmergency}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-xl border-border/80 font-semibold text-xs h-9 px-4"
              >
                Previous
              </Button>
              <span className="text-xs font-medium text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-xl border-border/80 font-semibold text-xs h-9 px-4"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Emergency Reschedule Request Modal */}
      {rescheduleBooking && (
        <RequestRescheduleModal
          bookingId={rescheduleBooking.id}
          bookingRef={rescheduleBooking.booking_reference}
          facilityName={rescheduleBooking.facility_name}
          bookingDate={rescheduleBooking.booking_date}
          startTime={rescheduleBooking.start_time}
          endTime={rescheduleBooking.end_time}
          helpdeskPhone={helpdeskPhone}
          helpdeskEmail={helpdeskEmail}
          onSubmit={async (data) => {
            const result = await submitRescheduleRequest(rescheduleBooking.id, {
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
      )}

      {/* Emergency Cancellation Request Modal */}
      {emergencyRequestBooking && (
        <RequestEmergencyCancellationModal
          bookingRef={emergencyRequestBooking.booking_reference}
          facilityName={emergencyRequestBooking.facility_name}
          bookingDate={emergencyRequestBooking.booking_date}
          bookingTime={`${emergencyRequestBooking.start_time} – ${emergencyRequestBooking.end_time}`}
          requiresPayment={emergencyRequestBooking.has_completed_payment}
          helpdeskPhone={helpdeskPhone}
          helpdeskEmail={helpdeskEmail}
          onSubmit={(reason, attachmentUrl) =>
            submitEmergencyRequest(emergencyRequestBooking.id, reason, attachmentUrl)
          }
          onClose={() => setEmergencyRequestBookingId(null)}
        />
      )}
      {/* Cancellation Proposal Accept Dialog */}
      <AlertDialog open={!!cancelProposalAcceptId} onOpenChange={open => { if (!open) setCancelProposalAcceptId(null) }}>
        <AlertDialogContent className="rounded-2xl border-border bg-card shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">Provide Refund Details</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Enter your account details so the Building Admin can process your refund.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="cancel-dest-name" className="text-xs font-semibold">Account Name</Label>
              <Input id="cancel-dest-name" value={cancelDestName} onChange={e => setCancelDestName(e.target.value)} placeholder="Full name on the receiving account" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cancel-dest-contact" className="text-xs font-semibold">Contact Number</Label>
              <Input id="cancel-dest-contact" value={cancelDestContact} onChange={e => setCancelDestContact(e.target.value)} placeholder="09XXXXXXXXX" className="rounded-xl h-11" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancelDestName.trim() || !cancelDestContact.trim()}
              onClick={() => cancelProposalAcceptId && handleCancellationProposalResponse(cancelProposalAcceptId, 'accept', cancelDestName.trim(), cancelDestContact.trim())}
              className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold"
            >
              Accept & Submit Details
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}