"use client"

/*
 * impeccable-direction contract (seed key ad3be52b)
 * THESIS: One ranked queue of everything that needs the Academic Head; refuses the
 * category-default three-tab split and the hero-metric card grid.
 * OWN-WORLD: STI institutional system — navy/blue/gold tokens, two-tone uppercase h1,
 * card surfaces at 12-16px radii with border-or-shadow elevation, dark mode native.
 * STORY: The head opens the console, sees at a glance what needs them (flagged reviews
 * first, then pending reservations, cancellations, faculty responses), searches to narrow,
 * selects a row, decides in the focus pane, and the queue updates in place.
 * FIRST VIEWPORT: Command bar spans the top with search and live counts; beneath it a
 * two-thirds-wide ranked list of labeled rows; a sticky right pane holds one decision.
 * FORM: Operator Console, structure seven of seven grounded candidates, seed key ad3be52b.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
 * review, the verdict, and DESIGN.md.
 */

import { useState, useCallback, useEffect, useMemo, useRef, type ComponentType, type SVGProps } from 'react'
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ROUTES } from "@/lib/routes"
import {
  RefreshCw, Loader2, CheckCircle, Search, ChevronLeft, ChevronRight,
  Trash2, Clock, LayoutList, ArrowRight, Flag, MessageSquare, Hourglass, Undo2, Inbox, CheckCheck, Calendar,
} from "lucide-react"
import { useMismatchReviews, type MismatchReviewItem } from "@/hooks/academic-head/useMismatchReviews"
import { useAcademicReservations, type SortBy, type AcademicReservationItem } from "@/hooks/academic-head/useAcademicReservations"
import { useCancellationRequests, type CancellationRequest } from "@/hooks/academic-head/useCancellationRequests"
import { MismatchReviewCard } from "../_components/MismatchReviewCard"
import { AcademicCalendar } from "../_components/AcademicCalendar"
import { ReservationInfoCard, type FacilityOption } from "../_components/ReservationInfoCard"
import { FixedClassSchedulesPreview } from "../_components/FixedClassSchedulesPreview"
import { CancellationFocusCard } from "./_components/CancellationFocusCard"
import { cn } from "@/lib/utils"
import { DashboardReviewBanner } from "@/components/shared/facilities/DashboardReviewBanner"
import { ReportEquipmentIssue } from "@/components/equipment/ReportEquipmentIssue"
import { formatTime, formatDate } from "./_components/cancellation-format"

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

type QueueItem =
  | { kind: 'review'; id: string; review: MismatchReviewItem }
  | { kind: 'reservation'; id: string; booking: AcademicReservationItem }
  | { kind: 'cancellation'; id: string; request: CancellationRequest }

type Selection = { kind: QueueItem['kind']; id: string } | null

const CONTRACT_HTML =
  '<!-- impeccable-direction: THESIS One ranked queue of everything that needs the Academic Head; refuses the three-tab split and hero-metric card grid. OWN-WORLD STI institutional system, navy/blue/gold tokens, two-tone uppercase h1, 12-16px card radii, border-or-shadow elevation, dark mode native. STORY The head opens the console, sees at a glance what needs them (flagged reviews first, then pending reservations, cancellations, faculty responses), searches to narrow, selects a row, decides in the focus pane, the queue updates in place. FIRST VIEWPORT Command bar spans the top with search and live counts; beneath it a two-thirds-wide ranked list of labeled rows; a sticky right pane holds one decision at a time. FORM Operator Console, structure seven of seven grounded candidates, seed key ad3be52b. FINISH unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. -->'

const rankOf = (item: QueueItem): number => {
  if (item.kind === 'review') return item.review.currentStatus === 'flagged' ? 0 : 3
  if (item.kind === 'reservation') return 1
  return 2
}

const STATE_CHIPS: Record<'flagged' | 'awaiting' | 'reservation' | 'cancellation', { label: string; icon: LucideIcon; classes: string }> = {
  flagged: {
    label: 'Needs Review',
    icon: Flag,
    classes: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  },
  awaiting: {
    label: 'Awaiting Faculty',
    icon: MessageSquare,
    classes: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400',
  },
  reservation: {
    label: 'Pending Approval',
    icon: Hourglass,
    classes: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  },
  cancellation: {
    label: 'Cancellation Request',
    icon: Undo2,
    classes: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400',
  },
}

export default function AcademicHeadDashboard() {
  const [view, setView] = useState<'console' | 'directory'>('console')
  const [commandQuery, setCommandQuery] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'cards'>('cards')
  const [pendingReservations, setPendingReservations] = useState<AcademicReservationItem[]>([])
  const [pendingResLoading, setPendingResLoading] = useState(false)
  const [now, setNow] = useState(new Date())
  const [classesToday, setClassesToday] = useState(0)
  const paneRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const { reviews, loading: reviewsLoading, submitReview, refresh: refreshReviews, submitting, batchApprove, batchApproving } = useMismatchReviews()
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set())
  const approvableReviews = reviews.filter(r => r.currentStatus === 'flagged')
  const toggleReviewSelection = useCallback((bookingId: string) => {
    setSelectedReviewIds(prev => {
      const next = new Set(prev)
      if (next.has(bookingId)) next.delete(bookingId)
      else next.add(bookingId)
      return next
    })
  }, [])
  const handleBatchApprove = useCallback(async () => {
    const ids = [...selectedReviewIds]
    await batchApprove(ids)
    setSelectedReviewIds(new Set())
  }, [selectedReviewIds, batchApprove])

  const {
    bookings, departments, totalPages, page, setPage,
    loading: reservationsLoading,
    fromDate, setFromDate,
    toDate, setToDate,
    departmentId, setDepartmentId,
    search, setSearch,
    sortBy, setSortBy,
    refresh: refreshReservations,
    cancelBooking,
    reviewBooking,
    proposeChanges,
    deleteBooking,
    bulkDeleteBookings,
  } = useAcademicReservations()

  const {
    requests: cancellationRequests,
    loading: cancellationsLoading,
    responding: cancellationResponding,
    reviewNotes: cancellationNotes,
    setReviewNotes: setCancellationNotes,
    respond: respondToCancellation,
    refresh: refreshCancellations,
    pendingCount: pendingCancellations,
  } = useCancellationRequests()

  useEffect(() => {
    fetch('/api/schedules/my-classes?scope=all')
      .then(r => r.ok ? r.json() : { classes: [] })
      .then(d => {
        const classes = d.classes || []
        const dayMap: Record<string, number> = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 }
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const todayIdx = dayMap[todayName]
        setClassesToday(classes.filter((c: any) => c.day_of_week === todayIdx).length)
      })
      .catch(() => {})
  }, [])

  const DELETABLE_STATUSES = ['cancelled', 'overridden', 'completed', 'rejected', 'auto_declined', 'approved', 'auto_approved']
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/facilities', { signal: controller.signal })
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setFacilities((d.facilities ?? []).map((f: any) => ({ id: f.id, name: f.name, room_number: f.room_number }))))
      .catch((err: any) => {
        if (err.name !== 'AbortError') console.error('[facilities] failed:', err)
      })
    return () => controller.abort()
  }, [])

  const fetchPendingReservations = useCallback(async () => {
    setPendingResLoading(true)
    try {
      const res = await fetch('/api/academic-head/reservations?status=pending&pageSize=50&sort_by=date_asc')
      if (!res.ok) return
      const data = await res.json()
      setPendingReservations(data.bookings ?? [])
    } catch (err) {
      console.error('[fetchPendingReservations] failed:', err)
    } finally { setPendingResLoading(false) }
  }, [])

  useEffect(() => { fetchPendingReservations() }, [fetchPendingReservations])

  const handleCancelBooking = useCallback(async (id: string, reason: string) => {
    await cancelBooking(id, reason)
    await refreshReservations()
  }, [cancelBooking, refreshReservations])

  const handleDeleteBooking = useCallback(async (id: string) => {
    await deleteBooking(id)
    await refreshReservations()
  }, [deleteBooking, refreshReservations])

  const handleReviewBooking = useCallback(async (id: string, action: 'approve' | 'reject', reason: string) => {
    await reviewBooking(id, action, reason)
    await refreshReservations()
  }, [reviewBooking, refreshReservations])

  const handleProposeChanges = useCallback(async (id: string, changes: any) => {
    await proposeChanges(id, changes)
    await refreshReservations()
  }, [proposeChanges, refreshReservations])

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const handleSelectAll = () => {
    const deletable = bookings.filter(b => DELETABLE_STATUSES.includes(b.status)).map(b => b.id);
    setSelectedIds(selectedIds.size === deletable.length ? new Set() : new Set(deletable));
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    await bulkDeleteBookings(Array.from(selectedIds));
    setSelectedIds(new Set());
    await refreshReservations();
    setBulkDeleting(false);
  }

  const queueItems: QueueItem[] = useMemo(() => {
    const items: QueueItem[] = [
      ...reviews.map(review => ({ kind: 'review' as const, id: review.bookingId, review })),
      ...pendingReservations.map(booking => ({ kind: 'reservation' as const, id: booking.id, booking })),
      ...cancellationRequests
        .filter(req => req.status === 'pending')
        .map(request => ({ kind: 'cancellation' as const, id: request.id, request })),
    ]
    return items.sort((a, b) => rankOf(a) - rankOf(b))
  }, [reviews, pendingReservations, cancellationRequests])

  const itemHaystack = (item: QueueItem): string => {
    if (item.kind === 'review') {
      const r = item.review
      return [r.facultyName, r.referenceNumber, r.facility?.name ?? '', r.facility?.room_number ?? '', r.department, r.departmentCode ?? ''].join(' ')
    }
    if (item.kind === 'reservation') {
      const b = item.booking
      return [b.facultyName, b.referenceNumber, b.facilityName, b.roomNumber ?? '', b.department, b.departmentCode ?? '', b.purpose ?? ''].join(' ')
    }
    const c = item.request
    return [c.users?.full_name ?? '', c.bookings?.booking_reference ?? '', c.bookings?.booking_facilities?.[0]?.facilities?.name ?? '', c.reason].join(' ')
  }

  const filteredQueue = useMemo(() => {
    const q = commandQuery.trim().toLowerCase()
    if (!q) return queueItems
    return queueItems.filter(item => itemHaystack(item).toLowerCase().includes(q))
  }, [queueItems, commandQuery])

  const selectedItem = useMemo(() => {
    if (!selection) return null
    return queueItems.find(item => item.kind === selection.kind && item.id === selection.id) ?? null
  }, [selection, queueItems])

  useEffect(() => {
    if (selection && paneRef.current && typeof window !== 'undefined' && window.innerWidth < 1024) {
      paneRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selection])

  const refreshQueue = useCallback(() => {
    refreshReviews()
    fetchPendingReservations()
    refreshCancellations()
  }, [refreshReviews, fetchPendingReservations, refreshCancellations])

  const awaitingReviewCount = reviews.filter(r => r.currentStatus === 'flagged').length
  const awaitingFacultyCount = reviews.filter(r => r.currentStatus === 'pending_faculty_response').length
  const activeToday = (bookings.filter(b => b.bookingDate === now.toISOString().split('T')[0] && ['approved', 'auto_approved'].includes(b.status)).length) + classesToday

  const queueLoading = reviewsLoading || pendingResLoading || cancellationsLoading

  const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: 'date_asc', label: 'Date (Oldest First)' },
    { value: 'date_desc', label: 'Date (Newest First)' },
    { value: 'status', label: 'Sort by Status' },
    { value: 'department', label: 'Sort by Department' },
  ]

  const PRIORITY_STATUSES = ['pending', 'flagged', 'pending_faculty_response']
  const displayedBookings = [...bookings].sort((a, b) => {
    const aP = PRIORITY_STATUSES.includes(a.status) ? 0 : 1
    const bP = PRIORITY_STATUSES.includes(b.status) ? 0 : 1
    return aP - bP
  })

  const selectItem = (item: QueueItem) => setSelection({ kind: item.kind, id: item.id })

  const queueRowTitle = (item: QueueItem): string => {
    if (item.kind === 'review') return item.review.facultyName
    if (item.kind === 'reservation') return item.booking.facultyName
    return item.request.users?.full_name ?? 'Unknown User'
  }

  const queueRowMeta = (item: QueueItem): string => {
    if (item.kind === 'review') {
      const r = item.review
      return `${r.facility?.name ?? 'Facility'} · ${r.facility?.room_number ?? ''} · ${formatDate(r.bookingDate)} · ${formatTime(r.startTime)}–${formatTime(r.endTime)}`.replace(/  +/g, ' ')
    }
    if (item.kind === 'reservation') {
      const b = item.booking
      return `${b.facilityName} · ${b.roomNumber ?? ''} · ${formatDate(b.bookingDate)} · ${formatTime(b.startTime)}–${formatTime(b.endTime)}`.replace(/  +/g, ' ')
    }
    const c = item.request
    return `${c.bookings?.booking_facilities?.[0]?.facilities?.name ?? 'Facility'} · ${formatDate(c.bookings?.booking_date)} · ${formatTime(c.bookings?.start_time)}–${formatTime(c.bookings?.end_time)}`
  }

  const queueRowRef = (item: QueueItem): string => {
    if (item.kind === 'review') return item.review.referenceNumber
    if (item.kind === 'reservation') return item.booking.referenceNumber
    return item.request.bookings?.booking_reference ?? 'N/A'
  }

  const chipKey = (item: QueueItem): keyof typeof STATE_CHIPS => {
    if (item.kind === 'review') return item.review.currentStatus === 'flagged' ? 'flagged' : 'awaiting'
    if (item.kind === 'reservation') return 'reservation'
    return 'cancellation'
  }

  const renderFocusPane = () => {
    if (!selectedItem) {
      return (
        <div className="bg-card rounded-2xl border border-dashed border-border p-10 text-center">
          <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">No item selected</p>
          <p className="text-xs text-muted-foreground mt-1">Select a queue row to decide it here, one at a time.</p>
        </div>
      )
    }
    if (selectedItem.kind === 'review') {
      const review = selectedItem.review
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-500" /> Mismatch Review
            </h2>
            <span className="text-xs font-semibold text-muted-foreground">{review.referenceNumber}</span>
          </div>
          <MismatchReviewCard
            review={review}
            submitting={submitting === review.bookingId}
            onSubmit={(action, options) => submitReview(review.bookingId, action, options)}
            selectable={review.currentStatus === 'flagged'}
            selected={selectedReviewIds.has(review.bookingId)}
            onToggleSelect={() => toggleReviewSelection(review.bookingId)}
          />
        </div>
      )
    }
    if (selectedItem.kind === 'reservation') {
      const booking = selectedItem.booking
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-blue-500" /> Pending Approval
            </h2>
            <span className="text-xs font-semibold text-muted-foreground">{booking.referenceNumber}</span>
          </div>
          <ReservationInfoCard
            booking={booking}
            onCancel={async (id, reason) => { await handleCancelBooking(id, reason); fetchPendingReservations() }}
            onReview={async (id, action, reason) => { await handleReviewBooking(id, action, reason); fetchPendingReservations() }}
            onProposeChanges={async (id, changes) => { await handleProposeChanges(id, changes); fetchPendingReservations() }}
            facilities={facilities}
          />
        </div>
      )
    }
    const request = selectedItem.request
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-rose-500" /> Cancellation Request
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">{request.bookings?.booking_reference ?? 'N/A'}</span>
        </div>
        <CancellationFocusCard
          request={request}
          responding={cancellationResponding === request.id}
          notes={cancellationNotes[request.id] ?? ''}
          onNotesChange={value => setCancellationNotes(prev => ({ ...prev, [request.id]: value }))}
          onRespond={action => respondToCancellation(request.id, action)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <span aria-hidden="true" className="hidden" dangerouslySetInnerHTML={{ __html: CONTRACT_HTML }} />

      <DashboardReviewBanner reservationsPath="/academic/my-reservations" />

      {/* BRAND HEADER & LIVE DATE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Academic Head <span className="text-accent-brand">Dashboard</span></h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
            Academic Program Oversight &amp; Facility Management for STI College Lucena
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ReportEquipmentIssue className="h-11" />
          <div className="flex items-center gap-3 bg-card px-4 py-2.5 rounded-xl border border-border shadow-xs">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </div>
            <span className="text-xs font-semibold text-foreground">
              {now.toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* COMMAND BAR + VERDICT STRIP */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={commandQuery}
              onChange={e => setCommandQuery(e.target.value)}
              placeholder="Search the action queue by faculty, room, or reference…"
              aria-label="Search the action queue"
              className="w-full h-11 pl-10 pr-4 bg-background border border-border rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2" data-testid="verdict-strip" role="group" aria-label="Queue counts">
            <span className="h-11 inline-flex items-center gap-2 px-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Flag className="w-4 h-4" />
              <span className="text-xs font-bold">Awaiting review</span>
              <span className="text-xs font-black tabular-nums" data-testid="verdict-awaiting-review">{awaitingReviewCount}</span>
            </span>
            <span className="h-11 inline-flex items-center gap-2 px-3 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-bold">Awaiting faculty</span>
              <span className="text-xs font-black tabular-nums" data-testid="verdict-awaiting-faculty">{awaitingFacultyCount}</span>
            </span>
            <span className="h-11 hidden sm:inline-flex items-center gap-2 px-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Hourglass className="w-4 h-4" />
              <span className="text-xs font-bold">Pending approvals</span>
              <span className="text-xs font-black tabular-nums" data-testid="verdict-pending-approvals">{pendingReservations.length}</span>
            </span>
            <span className="h-11 hidden md:inline-flex items-center gap-2 px-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Undo2 className="w-4 h-4" />
              <span className="text-xs font-bold">Cancellations</span>
              <span className="text-xs font-black tabular-nums" data-testid="verdict-cancellations">{pendingCancellations}</span>
            </span>
            <span className="h-11 hidden xl:inline-flex items-center gap-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold">Active today</span>
              <span className="text-xs font-black tabular-nums">{activeToday}</span>
            </span>
          </div>
        </div>
      </div>

      {/* VIEW TOGGLE */}
      <div className="flex items-center justify-between border-b border-border pb-0">
        <div className="flex p-1 bg-muted rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setView('console')}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view === 'console' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Inbox className="w-4 h-4" /> Action Queue
          </button>
          <button
            type="button"
            onClick={() => setView('directory')}
            data-testid="view-directory"
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
              view === 'directory' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutList className="w-4 h-4" /> All Reservations
          </button>
        </div>
        {view === 'console' && (
          <div className="flex items-center gap-3">
            {approvableReviews.length > 0 && (
              <button
                type="button"
                data-testid="select-all-flagged"
                onClick={() => setSelectedReviewIds(
                  selectedReviewIds.size === approvableReviews.length
                    ? new Set()
                    : new Set(approvableReviews.map(r => r.bookingId))
                )}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
              >
                {selectedReviewIds.size === approvableReviews.length ? 'Deselect all' : 'Select all flagged'}
              </button>
            )}
            {selectedReviewIds.size > 0 && (
              <Button
                size="sm"
                data-testid="batch-approve"
                onClick={handleBatchApprove}
                disabled={batchApproving}
                className="h-8 text-xs font-semibold uppercase tracking-wide"
              >
                {batchApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCheck className="w-3.5 h-3.5 mr-1.5" />}
                Approve {selectedReviewIds.size} selected
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshQueue}
              disabled={queueLoading}
              className="rounded-xl font-medium text-xs h-9 px-4"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-2", queueLoading && "animate-spin")} />
              Refresh Queue
            </Button>
          </div>
        )}
        {view === 'directory' && (
          <Link
            href={ROUTES.academic.reservations}
            className="text-xs font-semibold text-primary hover:underline hidden sm:flex items-center gap-1.5 px-3 py-2"
          >
            Full Reservations Directory <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {view === 'console' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT 2/3: RANKED ACTION QUEUE */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Action Queue
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{filteredQueue.length}</span>
              </h2>
            </div>

            {queueLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-card rounded-2xl p-5 border border-border animate-pulse space-y-3">
                    <div className="flex gap-4 items-center">
                      <div className="w-16 h-6 rounded-full bg-muted" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-40 bg-muted rounded" />
                        <div className="h-3 w-56 bg-muted rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredQueue.length === 0 && queueItems.length === 0 ? (
              <div className="bg-card rounded-2xl p-16 text-center border border-border shadow-xs" data-testid="console-empty">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">Nothing needs you right now</p>
                <p className="text-xs text-muted-foreground mt-1">All action items, mismatch reviews, and cancellation requests have been resolved.</p>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="bg-card rounded-2xl p-12 text-center border border-border shadow-xs">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">{'No matches for "' + commandQuery + '"'}</p>
                <p className="text-xs text-muted-foreground mt-1">Try a faculty name, room, or booking reference.</p>
                <Button variant="outline" size="sm" onClick={() => setCommandQuery('')} className="rounded-xl text-xs font-semibold mt-3">
                  Clear Search
                </Button>
              </div>
            ) : (
              <ul className="space-y-2" data-testid="console-queue" aria-label="Action queue">
                {filteredQueue.map((item, idx) => {
                  const chip = STATE_CHIPS[chipKey(item)]
                  const ChipIcon = chip.icon
                  const isSelected = selection?.kind === item.kind && selection?.id === item.id
                  return (
                    <li key={`${item.kind}-${item.id}`} data-testid="queue-row">
                      <button
                        type="button"
                        data-testid="queue-row-select"
                        onClick={() => selectItem(item)}
                        aria-label={`Select ${queueRowTitle(item)} — ${chip.label}`}
                        aria-current={isSelected}
                        className={cn(
                          "w-full text-left bg-card rounded-xl border p-4 transition-all hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary outline-none",
                          isSelected ? "border-primary shadow-xs ring-1 ring-primary" : "border-border"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0", chip.classes)}>
                            <ChipIcon className="w-3.5 h-3.5" />
                            {chip.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{queueRowTitle(item)}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{queueRowMeta(item)}</p>
                          </div>
                          <div className="shrink-0 text-right space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground tabular-nums">{queueRowRef(item)}</p>
                            <p className="text-[11px] text-muted-foreground/70">{idx === 0 ? 'Next up' : `#${idx + 1}`}</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="pt-2">
              <FixedClassSchedulesPreview />
            </div>
          </div>

          {/* RIGHT 1/3: FOCUS PANE */}
          <div className="lg:col-span-1 lg:sticky lg:top-6" ref={paneRef} data-testid="focus-pane">
            {renderFocusPane()}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* DIRECTORY TOOLBAR */}
          <div className="bg-card rounded-2xl border border-border p-5 mb-6 shadow-xs space-y-4" data-testid="directory-toolbar">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex p-1 bg-muted rounded-xl border border-border">
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    viewMode === 'cards' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutList className="w-4 h-4" /> Card View
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    viewMode === 'calendar' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Calendar className="w-4 h-4" /> Calendar View
                </button>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortBy)}
                  className="h-10 px-3 border border-border rounded-xl text-xs font-medium bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshReservations}
                  aria-label="Refresh reservations"
                  className="h-10 w-10 rounded-xl p-0"
                >
                  <RefreshCw className={cn("w-4 h-4", reservationsLoading && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/50">
              <div className="relative col-span-1 lg:col-span-2">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search reservations by faculty, room, or code..."
                  className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="h-10 px-3 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  aria-label="From Date"
                  className="w-1/2 h-10 px-3 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  aria-label="To Date"
                  className="w-1/2 h-10 px-3 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <AcademicCalendar bookings={bookings} loading={reservationsLoading} />
          ) : (
            <div className="space-y-4">
              {/* Bulk Action Toolbar */}
              {bookings.some(b => DELETABLE_STATUSES.includes(b.status)) && (
                <div className={cn("flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all", selectedIds.size > 0 ? "bg-red-500/10 border-red-500/30" : "bg-card border-border")}>
                  <button onClick={handleSelectAll} className="flex items-center gap-2.5 text-xs font-medium text-foreground">
                    <div className={cn("w-4 h-4 rounded-md border flex items-center justify-center transition-colors", selectedIds.size > 0 ? "bg-red-500 border-red-500" : "border-border bg-background")}>
                      {selectedIds.size > 0 && <div className="w-2 h-2 bg-white rounded-xs" />}
                    </div>
                    Select All Available for Deletion
                  </button>
                  {selectedIds.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting} className="rounded-xl font-semibold text-xs h-9 px-4 shadow-sm transition-all active:scale-95">
                      {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Delete Selected ({selectedIds.size})
                    </Button>
                  )}
                </div>
              )}
              {reservationsLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-card rounded-2xl p-6 border border-border animate-pulse space-y-4">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-xl bg-muted" />
                        <div className="space-y-2">
                          <div className="h-4 w-40 bg-muted rounded" />
                          <div className="h-3 w-32 bg-muted rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedBookings.length === 0 ? (
                <div className="bg-card rounded-2xl p-12 text-center border border-border shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No Reservations Found</p>
                    <p className="text-xs text-muted-foreground mt-1">There are no academic reservations matching your current filter criteria.</p>
                  </div>
                  {(search || departmentId || fromDate || toDate) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSearch(''); setDepartmentId(''); setFromDate(''); setToDate('') }}
                      className="rounded-xl text-xs font-semibold mt-2"
                    >
                      Reset Filters
                    </Button>
                  )}
                </div>
              ) : (
                displayedBookings.map(b => (
                  <ReservationInfoCard
                    key={b.id}
                    booking={b}
                    onCancel={handleCancelBooking}
                    onDelete={handleDeleteBooking}
                    onReview={handleReviewBooking}
                    onProposeChanges={handleProposeChanges}
                    facilities={facilities}
                    isSelected={selectedIds.has(b.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-8 pb-10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-border bg-card shadow-xs disabled:opacity-30 hover:border-primary transition-all"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="px-4 h-10 flex items-center bg-card border border-border rounded-xl text-xs font-semibold text-foreground">
                Page {page} of {totalPages}
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-border bg-card shadow-xs disabled:opacity-30 hover:border-primary transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
