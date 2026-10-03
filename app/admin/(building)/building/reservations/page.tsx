"use client"

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Download, Eye, Check, X,
  MapPin, Clock, Filter, Loader2, AlertTriangle, CalendarPlus
} from "lucide-react";
import { useBuildingBookings } from "@/hooks/admin/building/useBuildingBookings";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BookingDetailDrawer } from "@/components/admin/building/reservations/BookingDetailDrawer";
import { EmergencyRescheduleModal } from "@/components/admin/building/reservations/EmergencyRescheduleModal";
import { ReviewEmergencyRequestModal } from "@/components/admin/building/reservations/ReviewEmergencyRequestModal";
import { ReviewEmergencyRescheduleModal } from "@/components/admin/building/reservations/ReviewEmergencyRescheduleModal";
import type { BuildingBooking } from "@/backend/admin/building/building.types";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ROUTES } from '@/lib/routes'
import { bookingStatusLabel, bookingTypeLabel, emergencyRequestStatusLabel } from '@/lib/enum-labels'
import { SkeletonList } from "@/components/ui/SkeletonList";


const STATUS_BADGE_CLASS: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-500",
  auto_approved: "bg-emerald-500/10 text-emerald-500",
  overridden: "bg-emerald-500/10 text-emerald-500",
  pending: "bg-amber-500/10 text-amber-500",
  flagged: "bg-rose-500/10 text-rose-500",
  pending_user_response: "bg-orange-500/10 text-orange-600",
  pending_faculty_response: "bg-orange-500/10 text-orange-600",
  on_hold: "bg-purple-500/10 text-purple-600",
  cancellation_requested: "bg-orange-500/10 text-orange-600",
  cancellation_proposed: "bg-rose-500/10 text-rose-500",
  awaiting_reschedule: "bg-blue-500/10 text-blue-500",
  rejected: "bg-red-500/10 text-red-500",
  auto_declined: "bg-red-500/10 text-red-500",
  cancelled: "bg-slate-500/10 text-slate-500",
  completed: "bg-blue-500/10 text-blue-500",
}

export default function ReservationsPage() {
  const router = useRouter()
  const {
    bookings, search, setSearch, statusFilter, setStatusFilter,
    typeFilter, setTypeFilter, loading, updateBookingStatus, exportCSV, refresh
  } = useBuildingBookings()
  const [activeTab, setActiveTab] = useState<'bookings' | 'emergency-requests'>('bookings')
  const [emergencySubTab, setEmergencySubTab] = useState<'cancel' | 'reschedule'>('cancel')
  const [emergencyCancelCount, setEmergencyCancelCount] = useState(0)
  const [rescheduleRequestCount, setRescheduleRequestCount] = useState(0)
  const [emergencyRefreshKey, setEmergencyRefreshKey] = useState(0)
  const [reviewRequestId, setReviewRequestId] = useState<string | null>(null)
  const [reviewRescheduleId, setReviewRescheduleId] = useState<string | null>(null)

  const refreshEmergencyCounts = useCallback(() => {
    Promise.all([
      fetch('/api/admin/emergency-cancellation-requests?count=1&status=pending').then(r => r.ok ? r.json() : { count: 0 }),
      fetch('/api/admin/building/emergency-reschedule-requests?status=pending,pending_extra_payment,awaiting_reschedule&limit=1').then(r => r.ok ? r.json() : { total: 0 }),
    ]).then(([cancel, reschedule]) => {
      setEmergencyCancelCount(cancel?.count ?? 0)
      setRescheduleRequestCount(reschedule?.total ?? 0)
    }).catch(() => {})
  }, [])

  useEffect(() => { refreshEmergencyCounts() }, [refreshEmergencyCounts])

  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<BuildingBooking | null>(null);
  const [emergencyModalBooking, setEmergencyModalBooking] = useState<BuildingBooking | null>(null);
  const [defaultEmergencyMessage, setDefaultEmergencyMessage] = useState('');

  // Load default emergency message when modal opens
  useEffect(() => {
    if (emergencyModalBooking) {
      fetch('/api/admin/building/emergency-settings')
        .then(r => r.json())
        .then(d => setDefaultEmergencyMessage(d.rescheduleTemplate ?? ''))
        .catch(() => setDefaultEmergencyMessage(''))
    }
  }, [emergencyModalBooking?.id]);

  const handleEmergencyReschedule = useCallback(async (data: {
    newDate: string
    newStartTime: string
    newEndTime: string
    newFacilityId?: string
    customMessage: string
  }): Promise<boolean> => {
    if (!emergencyModalBooking) return false
    try {
      const res = await fetch(`/api/admin/building/bookings/${emergencyModalBooking.id}/emergency-reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_date: data.newDate,
          new_start_time: data.newStartTime,
          new_end_time: data.newEndTime,
          ...(data.newFacilityId ? { new_facility_id: data.newFacilityId } : {}),
          custom_message: data.customMessage,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        const errMsg = result.error ?? 'Failed to send proposal'
        toast({ title: 'Error', description: errMsg, variant: 'destructive' })
        sonnerToast.error(errMsg)
        return false
      }
      toast({ title: 'Proposal Sent', description: 'Emergency reschedule proposal sent to user.' })
      sonnerToast.success('Proposal Sent', { description: 'Emergency reschedule proposal sent to user.' })
      setSelectedBooking(null)
      setEmergencyModalBooking(null)
      refresh()
      refreshEmergencyCounts()
      setEmergencyRefreshKey(k => k + 1)
      return true
    } catch {
      const netErr = 'Network error. Please try again.'
      toast({ title: 'Error', description: netErr, variant: 'destructive' })
      sonnerToast.error(netErr)
      return false
    }
  }, [emergencyModalBooking, toast, refresh, refreshEmergencyCounts])

  const handleEmergencyHold = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/building/bookings/${id}/emergency-hold`, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) {
        const errMsg = result.error ?? 'Failed to put on hold'
        toast({ title: 'Error', description: errMsg, variant: 'destructive' })
        sonnerToast.error(errMsg)
        return false
      }
      toast({ title: 'On Hold', description: 'Booking has been placed on hold. User notified.' })
      sonnerToast.success('On Hold', { description: 'Booking has been placed on hold. User notified.' })
      refresh()
      refreshEmergencyCounts()
      setEmergencyRefreshKey(k => k + 1)
      return true
    } catch {
      const netErr = 'Network error. Please try again.'
      toast({ title: 'Error', description: netErr, variant: 'destructive' })
      sonnerToast.error(netErr)
      return false
    }
  }, [toast, refresh, refreshEmergencyCounts])

  const handleEmergencyCancelRefund = useCallback(async (id: string, amountCentavos: number, reason?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/building/bookings/${id}/emergency-cancel-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund_reason: reason, credit_amount_centavos: amountCentavos }),
      })
      const result = await res.json()
      if (!res.ok) {
        const errMsg = result.error ?? 'Failed to cancel booking'
        toast({ title: 'Error', description: errMsg, variant: 'destructive' })
        sonnerToast.error(errMsg)
        return false
      }
      const desc = result.message ?? 'Booking cancelled and session credit issued to user.'
      toast({ title: 'Booking Cancelled & Credit Issued', description: desc })
      sonnerToast.success('Booking Cancelled & Credit Issued', { description: desc })
      refresh()
      refreshEmergencyCounts()
      setEmergencyRefreshKey(k => k + 1)
      return true
    } catch {
      const netErr = 'Network error. Please try again.'
      toast({ title: 'Error', description: netErr, variant: 'destructive' })
      sonnerToast.error(netErr)
      return false
    }
  }, [toast, refresh, refreshEmergencyCounts])

  const handleProposeCancellation = useCallback(async (id: string, reason: string, refundAmountCentavos: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/building/bookings/${id}/propose-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, refund_amount_centavos: refundAmountCentavos }),
      })
      const result = await res.json()
      if (!res.ok) {
        const errMsg = result.error ?? 'Failed to propose cancellation'
        toast({ title: 'Error', description: errMsg, variant: 'destructive' })
        sonnerToast.error(errMsg)
        return false
      }
      toast({ title: 'Cancellation Proposed', description: 'Booker has been notified to accept or dispute.' })
      sonnerToast.success('Cancellation Proposed', { description: 'Booker has been notified to accept or dispute.' })
      refresh()
      refreshEmergencyCounts()
      setEmergencyRefreshKey(k => k + 1)
      return true
    } catch {
      const netErr = 'Network error. Please try again.'
      toast({ title: 'Error', description: netErr, variant: 'destructive' })
      sonnerToast.error(netErr)
      return false
    }
  }, [toast, refresh, refreshEmergencyCounts])

  const handleAskReschedule = useCallback(async (id: string, message?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/building/bookings/${id}/ask-reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const result = await res.json()
      if (!res.ok) {
        const errMsg = result.error ?? 'Failed to send reschedule request'
        toast({ title: 'Error', description: errMsg, variant: 'destructive' })
        sonnerToast.error(errMsg)
        return false
      }
      const desc = result.message ?? 'User has been notified to pick a new date.'
      toast({ title: 'Reschedule Request Sent', description: desc })
      sonnerToast.success('Reschedule Request Sent', { description: desc })
      refresh()
      refreshEmergencyCounts()
      setEmergencyRefreshKey(k => k + 1)
      return true
    } catch {
      const netErr = 'Network error. Please try again.'
      toast({ title: 'Error', description: netErr, variant: 'destructive' })
      sonnerToast.error(netErr)
      return false
    }
  }, [toast, refresh, refreshEmergencyCounts])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 px-4 lg:px-0">

      {/* BRAND HEADER SECTION */}
      <div className="px-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Reservation <span className="text-accent-brand">Control</span></h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Manage, verify, and monitor campus-wide facility bookings and scheduling requests in real-time
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => router.push(ROUTES.buildingAdmin.reserve)}
              variant="outline"
              className="font-semibold text-xs h-9 px-4 rounded-xl border-border bg-card hover:bg-muted/50 transition-all text-foreground"
            >
              <CalendarPlus className="w-4 h-4 mr-1.5 text-primary" /> Reserve for Myself
            </Button>
            <Button
              onClick={exportCSV}
              variant="outline"
              className="font-semibold text-xs h-9 px-4 rounded-xl border-border bg-card hover:bg-muted/50 transition-all text-foreground"
            >
              <Download className="w-4 h-4 mr-1.5 text-primary" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="flex flex-col lg:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-focus-within:scale-105 transition-transform" />
          <input
            placeholder="Search Reference, Requester, or Purpose..."
            className="w-full pl-10 pr-4 h-10 bg-card border border-border rounded-xl outline-none font-medium text-xs focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground shadow-xs text-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
          <Select value={typeFilter || "all"} onValueChange={v => setTypeFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-52 h-10 rounded-xl font-semibold text-xs border border-border bg-card px-3 hover:bg-muted/40 transition-colors text-foreground">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <SelectValue placeholder="Booking Type" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-card shadow-lg">
              <SelectItem value="all" className="text-xs font-medium">All Booking Types</SelectItem>
              <SelectItem value="internal_free" className="text-xs font-medium">Internal: Free (Faculty/Staff)</SelectItem>
              <SelectItem value="internal_paid" className="text-xs font-medium">Internal: Paid</SelectItem>
              <SelectItem value="external_paid" className="text-xs font-medium">External: Paid</SelectItem>
              <SelectItem value="school_event_block" className="text-xs font-medium">School Event Block</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl font-semibold text-xs border border-border bg-card px-3 hover:bg-muted/40 transition-colors text-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-card shadow-lg">
              <SelectItem value="all" className="text-xs font-medium">All Status</SelectItem>
              <SelectItem value="pending" className="text-xs font-medium">Pending</SelectItem>
              <SelectItem value="flagged" className="text-xs font-medium">Under Review</SelectItem>
              <SelectItem value="approved" className="text-xs font-medium">Approved</SelectItem>
              <SelectItem value="auto_approved" className="text-xs font-medium">Auto-Approved</SelectItem>
              <SelectItem value="overridden" className="text-xs font-medium">Overridden</SelectItem>
              <SelectItem value="pending_user_response" className="text-xs font-medium">Awaiting User Response</SelectItem>
              <SelectItem value="pending_faculty_response" className="text-xs font-medium">Awaiting Faculty Response</SelectItem>
              <SelectItem value="on_hold" className="text-xs font-medium">On Hold</SelectItem>
              <SelectItem value="cancellation_requested" className="text-xs font-medium">Cancellation Requested</SelectItem>
              <SelectItem value="awaiting_reschedule" className="text-xs font-medium">Awaiting Reschedule</SelectItem>
              <SelectItem value="rejected" className="text-xs font-medium">Declined</SelectItem>
              <SelectItem value="auto_declined" className="text-xs font-medium">Auto-Declined</SelectItem>
              <SelectItem value="cancelled" className="text-xs font-medium">Cancelled</SelectItem>
              <SelectItem value="completed" className="text-xs font-medium">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* UNIFIED VIEW NAVIGATION */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('bookings')}
          className={cn(
            'px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0',
            activeTab === 'bookings'
              ? 'bg-[#050d36] dark:bg-[#0072bc] text-white shadow-sm'
              : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          )}
        >
          All Reservations
        </button>
        <button
          onClick={() => {
            setActiveTab('emergency-requests')
            setEmergencySubTab('cancel')
          }}
          className={cn(
            'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0',
            activeTab === 'emergency-requests' && emergencySubTab === 'cancel'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-amber-500'
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Emergency Cancel Requests
          {emergencyCancelCount > 0 && (
            <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
              {emergencyCancelCount}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('emergency-requests')
            setEmergencySubTab('reschedule')
          }}
          className={cn(
            'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0',
            activeTab === 'emergency-requests' && emergencySubTab === 'reschedule'
              ? 'bg-[#0072bc] text-white shadow-sm'
              : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-blue-500'
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          Reschedule Requests
          {rescheduleRequestCount > 0 && (
            <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
              {rescheduleRequestCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'emergency-requests' && (
        <div className="space-y-4">
          {emergencySubTab === 'cancel' && (
            <EmergencyRequestsPanel
              onReview={id => setReviewRequestId(id)}
              onRefreshCount={refreshEmergencyCounts}
              refreshKey={emergencyRefreshKey}
            />
          )}
          {emergencySubTab === 'reschedule' && (
            <RescheduleRequestsPanel
              onReview={id => setReviewRescheduleId(id)}
              onSelectBooking={b => setSelectedBooking(b)}
              onRefreshCount={refreshEmergencyCounts}
              refreshKey={emergencyRefreshKey}
            />
          )}
        </div>
      )}

      {/* RESERVATION DATA TABLE — always in fiber tree to prevent Radix useId hydration mismatch */}
      <Card className={cn(
        "border-border bg-card rounded-xl overflow-hidden shadow-xs",
        activeTab !== 'bookings' && "hidden"
      )}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/60">
                <TableHead className="text-xs font-semibold uppercase pl-6 h-11 text-muted-foreground">Reference</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Requester</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Facilities</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-center text-muted-foreground">Schedule</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Purpose</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Course</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase pr-6 text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span className="text-xs font-medium text-muted-foreground">Retrieving Records...</span>
                  </TableCell>
                </TableRow>
              ) : bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-xs font-medium text-muted-foreground">
                    No Records Found
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((b) => (
                  <TableRow key={b.id} className="hover:bg-muted/30 border-border/40 transition-colors">
                    <TableCell className="font-semibold text-xs text-primary pl-6">#{b.bookingReference}</TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">{b.requesterName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {bookingTypeLabel(b.bookingType)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1 min-w-[120px]">
                        {b.facilities.map((f, i) => (
                          <span key={i} className="text-xs font-medium bg-muted/60 text-foreground px-2 py-0.5 rounded-md flex items-center gap-1 border border-border/40">
                            <MapPin className="w-3 h-3 text-primary shrink-0" /> {f.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col items-center min-w-[100px]">
                        <span className="text-xs font-medium text-foreground">{b.bookingDate}</span>
                        <span className="text-[11px] text-muted-foreground">{b.startTime} - {b.endTime}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge className={cn(
                        "text-[11px] font-medium border-none px-2.5 py-0.5 shadow-none rounded-full capitalize",
                        STATUS_BADGE_CLASS[b.currentStatus] ?? "bg-slate-500/10 text-slate-500"
                      )}>
                        {bookingStatusLabel(b.currentStatus)}
                      </Badge>
                    </TableCell>

                    <TableCell className="max-w-[140px]">
                      <span className="text-xs font-normal truncate block text-muted-foreground">{b.purpose}</span>
                    </TableCell>

                    <TableCell className="max-w-[140px]">
                      {b.courseCode ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-medium truncate text-foreground">{b.courseCode} — {b.courseName}</span>
                          {b.isElective && (
                            <span className="text-[11px] text-primary">Elective: {b.electiveType}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          className="h-8 px-3 rounded-lg font-semibold text-xs gap-1.5 hover:bg-primary/10 text-primary transition-all"
                          onClick={() => setSelectedBooking(b)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </Button>

                        {b.currentStatus === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost" size="icon"
                              className="h-9 w-9 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                              onClick={() => updateBookingStatus(b.id, 'approve')}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-9 w-9 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                              onClick={() => {
                                const reason = window.prompt('Provide Rejection Clause:');
                                if (reason?.trim()) {
                                  updateBookingStatus(b.id, 'reject', reason.trim());
                                }
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <BookingDetailDrawer
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onAction={updateBookingStatus}
        onEmergencyReschedule={(b) => {
          setSelectedBooking(null)
          setEmergencyModalBooking(b)
        }}
        onEmergencyHold={handleEmergencyHold}
        onEmergencyCancelRefund={handleEmergencyCancelRefund}
        onProposeCancellation={handleProposeCancellation}
        onAskReschedule={handleAskReschedule}
        onMismatchReview={async (id, action, opts) => {
          try {
            const res = await fetch(`/api/bookings/${id}/mismatch-review`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action,
                alternative_facility_id: opts?.alternativeFacilityId,
                reviewer_notes: opts?.reviewerNotes,
                alternative_date: opts?.alternativeDate,
                alternative_start_time: opts?.alternativeStartTime,
                alternative_end_time: opts?.alternativeEndTime,
              }),
            })
            if (!res.ok) {
              const raw = await res.text()
              console.error('[mismatch-review] response status:', res.status, 'raw body:', raw)
              let data: any = {}
              try { data = JSON.parse(raw) } catch {}
              const issueDetail = Array.isArray(data?.issues) && data.issues.length
                ? data.issues.map((i: any) => `${i.path?.join('.') || 'field'}: ${i.message}`).join('; ')
                : null
              toast({
                title: 'Review Failed',
                description: issueDetail
                  ? `${data.error}: ${issueDetail}`
                  : (data.error ?? raw?.slice(0, 200) ?? 'Could not submit review.'),
                variant: 'destructive',
              })
              return false
            }
            toast({ title: 'Review Submitted', description: `Booking ${action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'alternative suggested'} successfully.` })
            refresh()
            return true
          } catch {
            toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' })
            return false
          }
        }}
      />

      <EmergencyRescheduleModal
        booking={emergencyModalBooking}
        open={!!emergencyModalBooking}
        onClose={() => setEmergencyModalBooking(null)}
        onSubmit={handleEmergencyReschedule}
        defaultMessage={defaultEmergencyMessage}
      />

      {reviewRequestId && (
        <ReviewEmergencyRequestModal
          requestId={reviewRequestId}
          onClose={() => setReviewRequestId(null)}
          onResolved={() => { setReviewRequestId(null); refreshEmergencyCounts() }}
        />
      )}

      {reviewRescheduleId && (
        <ReviewEmergencyRescheduleModal
          requestId={reviewRescheduleId}
          onClose={() => setReviewRescheduleId(null)}
          onResolved={() => { setReviewRescheduleId(null); refreshEmergencyCounts() }}
        />
      )}

    </div>
  );
}

// ── Reschedule Requests Panel ─────────────────────────────────────────────────

interface RescheduleRequestsPanelProps {
  onReview: (id: string) => void
  onSelectBooking: (booking: BuildingBooking) => void
  onRefreshCount: () => void
  refreshKey?: number
}

function RescheduleRequestsPanel({ onReview, onSelectBooking, onRefreshCount, refreshKey }: RescheduleRequestsPanelProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  // Default shows all active requests (pending review + pending payment + awaiting reschedule)
  const [statusFilter, setStatusFilter] = useState('pending,pending_extra_payment,awaiting_reschedule')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/building/emergency-reschedule-requests?status=${statusFilter}`)
      const data = await res.json()
      setRequests(data.requests ?? [])
      setTotal(data.total ?? 0)
    } catch {}
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load, refreshKey])

  const TABS = [
    { key: 'pending,pending_extra_payment,awaiting_reschedule', label: 'Active' },
    { key: 'awaiting_reschedule', label: 'Awaiting Reschedule' },
    { key: 'pending', label: 'Pending Review' },
    { key: 'pending_extra_payment', label: 'Pending Payment' },
    { key: 'approved', label: 'Approved' },
    { key: 'declined', label: 'Declined' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ]

  return (
    <Card className="border-border bg-card rounded-xl overflow-hidden shadow-xs">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                statusFilter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{total} records</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs font-medium text-muted-foreground">
            No {TABS.find(t => t.key === statusFilter)?.label.toLowerCase() ?? statusFilter} reschedule requests
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {requests.map((req: any) => {
            const facilityName = req.booking?.booking_facilities?.[0]?.facilities?.name ?? 'Facility'
            const extraPeso = req.extra_amount_centavos > 0
              ? `₱${(req.extra_amount_centavos / 100).toFixed(2)} extra`
              : 'No extra charge'
            const isAwaiting = req.request_type === 'awaiting_reschedule' || req.status === 'awaiting_reschedule'

            return (
              <div key={req.id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{req.booking?.booking_reference}</span>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-medium capitalize',
                      isAwaiting ? 'bg-blue-500/10 text-blue-600' :
                      req.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                      req.status === 'pending_extra_payment' ? 'bg-orange-500/10 text-orange-600' :
                      req.status === 'approved' || req.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                      req.status === 'declined' ? 'bg-red-500/10 text-red-500' :
                      'bg-slate-500/10 text-slate-500'
                    )}>
                      {isAwaiting ? 'Awaiting Reschedule' : emergencyRequestStatusLabel(req.status)}
                    </span>
                    {req.extra_amount_centavos > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600">
                        {extraPeso}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {req.user?.full_name} · {facilityName}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Original: {req.original_date} {req.original_start_time?.slice(0,5)}–{req.original_end_time?.slice(0,5)}</span>
                    {req.proposed_date && (
                      <>
                        <span className="text-primary">→</span>
                        <span className="text-primary font-semibold">Proposed: {req.proposed_date} {req.proposed_start_time?.slice(0,5)}–{req.proposed_end_time?.slice(0,5)}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 max-w-xl italic">
                    "{req.reason}"
                  </p>
                  {req.reschedule_deadline && (
                    <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      Offer Deadline: {new Date(req.reschedule_deadline).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60">
                    Submitted/Updated {new Date(req.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    if (isAwaiting && req.booking) {
                      onSelectBooking(req.booking)
                    } else {
                      onReview(req.id)
                    }
                    onRefreshCount()
                  }}
                  className="rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 h-8 px-3"
                >
                  {isAwaiting ? 'Manage Booking' : 'Review'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── Emergency Requests Panel ──────────────────────────────────────────────────

interface EmergencyRequestsPanelProps {
  onReview: (id: string) => void
  onRefreshCount: () => void
  refreshKey?: number
}

function EmergencyRequestsPanel({ onReview, onRefreshCount, refreshKey }: EmergencyRequestsPanelProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/emergency-cancellation-requests?status=${statusFilter}`)
      const data = await res.json()
      setRequests(data.requests ?? [])
      setTotal(data.total ?? 0)
    } catch {}
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load, refreshKey])

  return (
    <Card className="border-border bg-card rounded-xl overflow-hidden shadow-xs">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {(['pending', 'approved', 'denied', 'withdrawn', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all',
                statusFilter === s
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{total} records</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 px-4 space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto" />
          <h4 className="text-sm font-bold text-foreground">No {statusFilter} Emergency Cancellation Requests</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Emergency cancellation submissions will appear here for review.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {requests.map((req: any) => {
            const facilityRow = req.booking?.booking_facilities?.[0]?.facilities
            const facilityName = facilityRow?.name ?? 'Facility'
            return (
              <div key={req.id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground">{req.booking?.booking_reference}</span>
                    <span className={cn(
                      'px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize',
                      req.status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      req.status === 'denied' ? 'bg-red-500/10 text-red-500' :
                      'bg-slate-500/10 text-slate-500'
                    )}>
                      {emergencyRequestStatusLabel(req.status)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {req.user?.full_name} · {facilityName} · {req.booking?.booking_date}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-xl italic">
                    "{req.reason}"
                  </p>
                  {req.completed_payment_centavos > 0 && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Paid: ₱{(req.completed_payment_centavos / 100).toFixed(2)}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70">
                    Submitted {new Date(req.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {req.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => { onReview(req.id); onRefreshCount() }}
                    className="rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shrink-0 h-8 px-3"
                  >
                    Review
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

