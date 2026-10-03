'use client'

import { useState, useEffect } from 'react'
import {
  MapPin, Clock, Users, ChevronDown, ChevronUp, AlertTriangle, Star, Loader2,
  Check, X, CalendarClock, Trash2, Building2, User2, Info, Hash, ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AcademicReservationItem } from '@/hooks/academic-head/useAcademicReservations'
import { bookingStatusLabel } from '@/lib/enum-labels'

const CANCELLABLE_STATUSES = ['auto_approved', 'approved', 'flagged', 'pending', 'pending_faculty_response']
const REVIEWABLE_STATUSES = ['pending', 'flagged']
const PROPOSABLE_STATUSES = ['pending', 'flagged', 'auto_approved', 'approved']
const DELETABLE_STATUSES = ['cancelled', 'overridden', 'completed', 'rejected', 'auto_declined', 'approved', 'auto_approved']

export interface FacilityOption {
  id: string
  name: string
  room_number: string | null
}

interface AvailableFacility {
  id: string
  name: string
  room_number: string | null
  floor_number: number | null
  building_name: string | null
  is_available: boolean
  conflict_reason: string | null
}

interface ReservationInfoCardProps {
  booking: AcademicReservationItem
  onCancel?: (id: string, reason: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onReview?: (id: string, action: 'approve' | 'reject', reason: string) => Promise<void>
  onProposeChanges?: (id: string, changes: {
    proposed_date?: string
    proposed_start_time?: string
    proposed_end_time?: string
    proposed_facility_id?: string
    reason: string
  }) => Promise<void>
  facilities?: FacilityOption[]
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

const STATUS_BADGE: Record<string, string> = {
  auto_approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 font-semibold',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 font-semibold',
  overridden: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400 font-semibold',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 font-semibold',
  flagged: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 font-semibold',
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 font-semibold',
  pending_faculty_response: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400 font-semibold',
  auto_declined: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400 font-semibold',
  rejected: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400 font-semibold',
  cancelled: 'bg-muted text-muted-foreground border-border font-medium',
  cancellation_requested: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400 font-semibold',
  cancellation_proposed: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 font-semibold',
}

const STATUS_LABEL: Record<string, string> = {
  auto_approved: 'Approved', approved: 'Approved', overridden: 'Overridden',
  completed: 'Completed', flagged: 'Pending Review', pending: 'Pending',
  pending_faculty_response: 'Action Required',
  auto_declined: 'Declined', rejected: 'Declined', cancelled: 'Cancelled',
  cancellation_requested: 'Cancel Requested',
  cancellation_proposed: 'Cancellation Proposed',
}

const PURPOSE_LABELS: Record<string, string> = {
  academic: 'Academic / Class',
  school_event: 'School Event',
  department_use: 'Department Use',
  personal: 'Personal',
  commercial: 'Commercial',
  community: 'Community',
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function ReservationInfoCard({ booking: b, onCancel, onDelete, onReview, onProposeChanges, facilities, isSelected, onToggleSelect }: ReservationInfoCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Cancel state
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  // Delete state
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Review state
  const [reviewing, setReviewing] = useState(false)
  const [reviewReason, setReviewReason] = useState('')
  const [reviewError, setReviewError] = useState('')

  // Propose changes state
  const [showPropose, setShowPropose] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [proposeError, setProposeError] = useState('')
  const [proposeReason, setProposeReason] = useState('')
  const [propDate, setPropDate] = useState('')
  const [propStartTime, setPropStartTime] = useState('')
  const [propEndTime, setPropEndTime] = useState('')
  const [propFacilityId, setPropFacilityId] = useState('')
  const [availableFacilities, setAvailableFacilities] = useState<AvailableFacility[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)

  // Fetch available facilities when date + start + end are all set
  useEffect(() => {
    if (!propDate || !propStartTime || !propEndTime) {
      setAvailableFacilities([])
      return
    }
    setLoadingAvail(true)
    fetch(`/api/academic-head/available-facilities?date=${propDate}&start_time=${propStartTime}&end_time=${propEndTime}`)
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setAvailableFacilities(d.facilities ?? []))
      .catch(() => setAvailableFacilities([]))
      .finally(() => setLoadingAvail(false))
  }, [propDate, propStartTime, propEndTime])

  // Quick action state (for inline approve/reject buttons)
  const [quickAction, setQuickAction] = useState<'approve' | 'reject' | null>(null)
  const [quickError, setQuickError] = useState('')

  const canCancel = !!onCancel && CANCELLABLE_STATUSES.includes(b.status)
  const canDelete = !!onDelete && DELETABLE_STATUSES.includes(b.status)
  const canReview = !!onReview && REVIEWABLE_STATUSES.includes(b.status)
  const canPropose = !!onProposeChanges && PROPOSABLE_STATUSES.includes(b.status)

  async function handleCancel() {
    if (!onCancel || cancelReason.length < 20) return
    setCancelling(true)
    setCancelError('')
    try {
      await onCancel(b.id, cancelReason)
      setCancelReason('')
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel booking')
    } finally {
      setCancelling(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(b.id)
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Failed to delete booking')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleReview(action: 'approve' | 'reject') {
    if (!onReview || reviewReason.length < 10) return
    setReviewing(true)
    setReviewError('')
    try {
      await onReview(b.id, action, reviewReason)
      setReviewReason('')
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : `Failed to ${action} booking`)
    } finally {
      setReviewing(false)
    }
  }

  async function handlePropose() {
    if (!onProposeChanges || proposeReason.length < 10) return
    if (!propDate && !propStartTime && !propEndTime && !propFacilityId) {
      setProposeError('Please specify at least one change')
      return
    }
    setProposing(true)
    setProposeError('')
    try {
      await onProposeChanges(b.id, {
        proposed_date: propDate || undefined,
        proposed_start_time: propStartTime || undefined,
        proposed_end_time: propEndTime || undefined,
        proposed_facility_id: propFacilityId || undefined,
        reason: proposeReason,
      })
      setPropDate('')
      setPropStartTime('')
      setPropEndTime('')
      setPropFacilityId('')
      setProposeReason('')
      setShowPropose(false)
    } catch (err: unknown) {
      setProposeError(err instanceof Error ? err.message : 'Failed to propose changes')
    } finally {
      setProposing(false)
    }
  }

  async function handleQuickReview(action: 'approve' | 'reject') {
    if (!onReview) return
    setQuickAction(action)
    setQuickError('')
    try {
      await onReview(b.id, action, action === 'approve' ? 'Approved by Academic Head' : 'Rejected by Academic Head')
    } catch (err: unknown) {
      setQuickError(err instanceof Error ? err.message : `Failed to ${action}`)
    } finally {
      setQuickAction(null)
    }
  }

  const facilityDisplay = `${b.facilityName}${b.roomNumber ? ` (Room ${b.roomNumber})` : ''}`
  const locationDisplay = [
    b.buildingName,
    b.floorNumber != null ? `Floor ${b.floorNumber}` : null,
  ].filter(Boolean).join(' · ')

  const duration = formatDuration(b.durationMinutes)

  const selectable = !!onToggleSelect && DELETABLE_STATUSES.includes(b.status)

  return (
    <div className={cn(
      "group relative flex flex-col transition-all duration-200 rounded-2xl overflow-hidden border bg-card",
      isSelected 
        ? "border-primary ring-1 ring-primary/20 shadow-xs" 
        : "border-border shadow-xs hover:border-border/80"
    )}>
      {/* Selection Overlay */}
      {isSelected && <div className="absolute inset-0 bg-primary/5 pointer-events-none sm:hidden" />}

      <div className="p-5 sm:p-6 space-y-4">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {selectable && (
              <button
                onClick={() => onToggleSelect!(b.id)}
                className={cn(
                  "shrink-0 mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                  isSelected 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-border bg-background hover:border-primary/50"
                )}
                aria-label={isSelected ? 'Deselect' : 'Select'}
              >
                {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                  {b.departmentCode ?? b.department}
                </span>
                <span className="text-xs font-mono text-muted-foreground hidden sm:inline">#{b.referenceNumber}</span>
              </div>
              <h3 className="font-bold text-foreground text-base tracking-tight truncate">
                {b.facultyName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                <User2 className="w-3.5 h-3.5 text-muted-foreground" /> {b.facultyEmail || 'No Email Provided'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
             <span className="text-xs font-mono text-muted-foreground sm:hidden">#{b.referenceNumber}</span>
             <span className={cn(
                "px-2.5 py-0.5 rounded-md text-xs font-semibold border",
                STATUS_BADGE[b.status] ?? STATUS_BADGE.pending
            )}>
              {STATUS_LABEL[b.status] ?? bookingStatusLabel(b.status)}
            </span>
          </div>
        </div>

        {/* Info Grid Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="p-2 rounded-lg bg-background border border-border/50 text-primary">
                <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{facilityDisplay}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate">{locationDisplay || 'Main Facility'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="p-2 rounded-lg bg-background border border-border/50 text-amber-500">
                <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{b.bookingDate}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[11px] font-medium text-muted-foreground">{b.startTime} - {b.endTime}</p>
                {duration && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1 rounded">({duration})</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="p-2 rounded-lg bg-background border border-border/50 text-emerald-500">
                <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{PURPOSE_LABELS[b.bookingPurpose] ?? b.bookingPurpose}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate">{b.expectedAttendees || 0} Expected Attendees</p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-border/50 gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {b.decisionScore != null && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Priority Score: <span className="font-bold text-foreground">{b.decisionScore}</span></span>
              </div>
            )}
            {b.mismatchFlag === 'UNRECOGNIZED_CROSS_DEPT_USE' && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md border border-destructive/20">
                <AlertTriangle className="w-3 h-3" /> Mismatch Detected
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {canReview && (
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none h-9 px-4 font-semibold text-xs rounded-xl"
                  onClick={() => handleQuickReview('approve')}
                  disabled={quickAction !== null}
                >
                  {quickAction === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 sm:flex-none h-9 px-4 font-semibold text-xs rounded-xl"
                  onClick={() => handleQuickReview('reject')}
                  disabled={quickAction !== null}
                >
                  {quickAction === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1.5" />}
                  Reject
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(e => !e)}
              className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? 'Hide Details' : 'View Details'}
            </Button>
          </div>
        </div>
        {quickError && (
          <p className="text-xs text-destructive mt-2 bg-destructive/10 p-2 rounded-lg border border-destructive/20">{quickError}</p>
        )}
      </div>

      {/* Detail Expansion Pane */}
      {expanded && (
        <div className="px-5 sm:px-6 pb-5 pt-3 border-t border-border/50 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Info className="w-3.5 h-3.5" /> Reservation Context
                    </label>
                    <p className="text-xs text-foreground bg-background p-3.5 rounded-xl border border-border/50">
                        {b.purpose}
                    </p>
                </div>
                {b.courseCode && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Course / Subject</label>
                        <div className="p-3.5 rounded-xl border border-border/50 bg-background">
                            <p className="text-xs text-foreground font-bold flex items-center gap-2 flex-wrap">
                                <span>{b.courseCode}</span>
                                {b.courseName && <span className="font-medium text-muted-foreground">— {b.courseName}</span>}
                                {b.sessionType && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                                        {b.sessionType}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Formal Review Form */}
            {canReview && (
              <div id={`review-${b.id}`} className="p-4 rounded-xl bg-background border border-border/50 space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" /> Formal Review Decision Log
                </h4>
                <textarea
                  value={reviewReason}
                  onChange={e => { setReviewReason(e.target.value); setReviewError('') }}
                  placeholder="Explain your decision for the audit log..."
                  rows={3}
                  className="w-full text-xs rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className={cn(
                    "text-[11px] font-medium",
                    reviewReason.length < 10 ? 'text-muted-foreground' : 'text-emerald-600 font-semibold'
                  )}>
                    Progress: {reviewReason.length}/10 Characters Minimum
                  </span>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      className="flex-1 sm:flex-none h-9 px-4 font-semibold text-xs rounded-xl"
                      onClick={() => handleReview('approve')}
                      disabled={reviewReason.length < 10 || reviewing}
                    >
                      {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Approve'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 sm:flex-none h-9 px-4 font-semibold text-xs rounded-xl"
                      onClick={() => handleReview('reject')}
                      disabled={reviewReason.length < 10 || reviewing}
                    >
                      {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Reject'}
                    </Button>
                  </div>
                </div>
                {reviewError && (
                  <p className="text-xs text-destructive font-medium">{reviewError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}