'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { cn } from '@/lib/utils'
import { bookingStatusLabel } from '@/lib/enum-labels'
import {
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    CalendarDays,
    Building2,
    CalendarPlus,
    History,
    Info,
    X,
    ChevronDown,
    Clock,
} from 'lucide-react'
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
import { FacilityMultiSelect, type FacilityOption } from './FacilityMultiSelect'
import { resolveGroupActions, type GroupActionKind, type ScheduleEventViewerRole } from './resolveGroupActions'

type Mode = 'school_event' | 'exam_period'

interface ScheduleEventGroup {
    group_id: string | null
    event_name: string
    block_category: string | null
    current_status: string
    created_by_name?: string
    created_by_id?: string
    dates: string[]
    facilities: FacilityOption[]
    booking_ids?: string[]
}

const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    auto_approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    cancellation_requested: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    completed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    cancelled: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
}

const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending Review',
    auto_approved: 'Active',
    cancellation_requested: 'Cancellation Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
}

const ACTION_LABEL: Record<GroupActionKind, { label: string; icon: typeof CheckCircle; tone: string }> = {
    approve: { label: 'Approve', icon: CheckCircle, tone: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
    legacy_approve: { label: 'Approve', icon: CheckCircle, tone: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
    reject: { label: 'Reject', icon: XCircle, tone: 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30' },
    legacy_reject: { label: 'Reject', icon: XCircle, tone: 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30' },
    withdraw: { label: 'Withdraw', icon: XCircle, tone: 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-950/30' },
    cancel: { label: 'Cancel Event', icon: XCircle, tone: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30' },
    legacy_cancel: { label: 'Cancel Event', icon: XCircle, tone: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30' },
    request_cancellation: { label: 'Request Cancellation', icon: XCircle, tone: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30' },
    confirm_cancellation: { label: 'Confirm Cancellation', icon: CheckCircle, tone: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
    decline_cancellation: { label: 'Decline', icon: XCircle, tone: 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30' },
    legacy_delete: { label: 'Delete', icon: X, tone: 'text-slate-400 hover:text-rose-500' },
}

interface SchoolEventsPanelProps {
    viewerRole: ScheduleEventViewerRole
}

export function SchoolEventsPanel({ viewerRole }: SchoolEventsPanelProps) {
    const { user } = useAuth()
    const isAH = viewerRole === 'academic_head'

    const [facilities, setFacilities] = useState<FacilityOption[]>([])
    const [groups, setGroups] = useState<ScheduleEventGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [busyGroupId, setBusyGroupId] = useState<string | null>(null)

    const [mode, setMode] = useState<Mode>('school_event')
    const [eventName, setEventName] = useState('')
    const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [selectedDays, setSelectedDays] = useState<Date[] | undefined>([])

    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
    const [displacedData, setDisplacedData] = useState<{ bookings: any[]; class_schedules: any[] } | null>(null)
    const [loadingDisplaced, setLoadingDisplaced] = useState(false)

    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void }>({
        open: false,
        title: '',
        description: '',
        onConfirm: () => {},
    })

    useEffect(() => {
        fetchAll()
    }, [])

    async function fetchAll() {
        setLoading(true)
        try {
            const [facRes, eventsRes] = await Promise.all([
                fetch('/api/facilities?all=true'),
                fetch('/api/academic-head/schedule-events'),
            ])
            const facData = await facRes.json()
            const eventsData = await eventsRes.json()
            setFacilities(facData.facilities || [])
            setGroups(eventsData.events || [])
        } catch (err: any) {
            toast.error(err.message || 'Failed to load schedule data')
        } finally {
            setLoading(false)
        }
    }

    async function toggleDisplaced(groupId: string | null) {
        if (!groupId) return
        if (expandedGroupId === groupId) {
            setExpandedGroupId(null)
            setDisplacedData(null)
            return
        }
        setExpandedGroupId(groupId)
        setLoadingDisplaced(true)
        try {
            const res = await fetch(`/api/academic-head/schedule-events/group/${groupId}/displaced`)
            const data = await res.json()
            if (res.ok) setDisplacedData(data)
        } catch {} finally {
            setLoadingDisplaced(false)
        }
    }

    function switchMode(next: Mode) {
        setMode(next)
        if (next === 'exam_period') {
            setSelectedFacilityIds(facilities.map((f) => f.id))
        } else {
            setSelectedFacilityIds([])
        }
    }

    const allFacilitiesChecked = facilities.length > 0 && selectedFacilityIds.length === facilities.length

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!eventName) {
            toast.error('Please enter an event name')
            return
        }
        if (mode === 'school_event' && (selectedFacilityIds.length === 0 || !startDate || !endDate)) {
            toast.error('Please select at least one facility and a date range')
            return
        }
        if (mode === 'exam_period' && (!selectedDays || selectedDays.length === 0)) {
            toast.error('Please pick at least one exam day')
            return
        }

        const body: Record<string, any> = {
            event_name: eventName,
            mode,
        }
        if (mode === 'school_event') {
            body.start_date = startDate
            body.end_date = endDate
            body.start_time = '08:00'
            body.end_time = '17:00'
            body.facility_ids = selectedFacilityIds
        } else {
            body.dates = (selectedDays ?? []).map((d) => d.toISOString().split('T')[0])
            body.start_time = '00:00'
            body.end_time = '23:59'
            if (allFacilitiesChecked) {
                body.all_facilities = true
            } else {
                body.facility_ids = selectedFacilityIds
            }
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/academic-head/schedule-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to submit')
            toast.success(
                data.status === 'pending'
                    ? 'Request submitted for Building Admin approval.'
                    : 'School event created.'
            )
            setEventName('')
            setStartDate('')
            setEndDate('')
            setSelectedDays([])
            switchMode(mode)
            fetchAll()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    async function runGroupAction(group: ScheduleEventGroup, action: GroupActionKind) {
        setBusyGroupId(group.group_id ?? group.booking_ids?.[0] ?? null)
        try {
            if (action === 'legacy_approve' || action === 'legacy_reject' || action === 'legacy_cancel' || action === 'legacy_delete') {
                const id = group.booking_ids?.[0]
                if (action === 'legacy_delete') {
                    const res = await fetch(`/api/academic-head/schedule-events/${id}`, { method: 'DELETE' })
                    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
                } else {
                    const patchAction = action === 'legacy_approve' ? 'approve' : 'cancel'
                    const res = await fetch(`/api/academic-head/schedule-events/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: patchAction }),
                    })
                    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update event')
                }
            } else {
                const res = await fetch(`/api/academic-head/schedule-events/group/${group.group_id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action }),
                })
                if (!res.ok) throw new Error((await res.json()).error || 'Failed to update event')
            }
            toast.success('Updated.')
            fetchAll()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setBusyGroupId(null)
        }
    }

    function confirmAction(group: ScheduleEventGroup, action: GroupActionKind, title: string, description: string) {
        setConfirmDialog({
            open: true,
            title,
            description,
            onConfirm: () => runGroupAction(group, action),
        })
    }

    const venueCount = selectedFacilityIds.length
    const dayCount = mode === 'school_event' ? (startDate && endDate ? 1 : 0) : (selectedDays?.length || 0)

    const selectedFacilityObjects = useMemo(
        () => facilities.filter((f) => selectedFacilityIds.includes(f.id)),
        [facilities, selectedFacilityIds]
    )

    const impactDetails = useMemo(() => {
        if (mode === 'school_event' && (venueCount === 0 || !startDate || !endDate)) return null
        if (mode === 'exam_period' && (!selectedDays || selectedDays.length === 0)) return null

        const approvalNote = isAH
            ? 'Requires Building Admin approval before taking effect.'
            : 'Enforces schedule block immediately upon creation.'

        const scopeNote = mode === 'exam_period' && allFacilitiesChecked
            ? `Campus-wide block across all ${facilities.length} facilities for ${dayCount} day${dayCount === 1 ? '' : 's'}`
            : `Targeted block for ${venueCount} facility${venueCount === 1 ? '' : 'ies'} across ${dayCount} day${dayCount === 1 ? '' : 's'}`

        return {
            scopeNote,
            approvalNote,
            venueCount,
            dayCount,
            affectedRooms: selectedFacilityObjects.slice(0, 5),
            remainingRoomCount: Math.max(0, selectedFacilityObjects.length - 5),
        }
    }, [mode, venueCount, startDate, endDate, selectedDays, dayCount, allFacilitiesChecked, facilities.length, isAH, selectedFacilityObjects])

    function setQuickDates(daysOffset: number) {
        const today = new Date()
        const end = new Date(today)
        end.setDate(today.getDate() + daysOffset)
        setStartDate(today.toISOString().split('T')[0])
        setEndDate(end.toISOString().split('T')[0])
    }

    return (
        <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5">
                    <Card className="bg-white dark:bg-[#111827] border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
                        <CardHeader className="bg-slate-50/80 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <CalendarPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Schedule a Block</CardTitle>
                            </div>
                            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                                Reserve facilities for a school event, or block all facilities for an exam period.
                            </CardDescription>

                            <div role="tablist" className="flex mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-1 bg-slate-100/60 dark:bg-slate-900/40">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mode === 'school_event'}
                                    onClick={() => switchMode('school_event')}
                                    className={cn(
                                        'flex-1 h-8 rounded-md text-xs font-semibold transition-colors',
                                        mode === 'school_event' ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-bold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    )}
                                >
                                    School Event
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mode === 'exam_period'}
                                    onClick={() => switchMode('exam_period')}
                                    className={cn(
                                        'flex-1 h-8 rounded-md text-xs font-semibold transition-colors',
                                        mode === 'exam_period' ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-bold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    )}
                                >
                                    Exam Period
                                </button>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <Label htmlFor="event-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Event Title <span className="text-rose-500">*</span>
                                    </Label>
                                    <Input
                                        id="event-name"
                                        className="h-11 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm focus-visible:ring-blue-500"
                                        value={eventName}
                                        onChange={(e) => setEventName(e.target.value)}
                                        placeholder="e.g. STI College IT Week 2026"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Target Venue{mode === 'exam_period' ? 's (defaults to all)' : ''} <span className="text-rose-500">*</span>
                                    </Label>
                                    <FacilityMultiSelect facilities={facilities} selectedIds={selectedFacilityIds} onChange={setSelectedFacilityIds} loading={loading} />
                                </div>

                                {mode === 'school_event' ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="start-date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Event Dates <span className="text-rose-500">*</span>
                                            </Label>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setQuickDates(0)}
                                                    className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                                                >
                                                    Today
                                                </Button>
                                                <span className="text-[10px] text-slate-300 dark:text-slate-700">·</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setQuickDates(7)}
                                                    className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                                                >
                                                    Next 7 Days
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <Input type="date" id="start-date" aria-label="Start Date" className="h-11 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                                            <Input type="date" id="end-date" aria-label="End Date" className="h-11 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Exam Days <span className="text-rose-500">*</span></Label>
                                            {selectedDays && selectedDays.length > 0 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedDays([])}
                                                    className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                                                >
                                                    Clear ({selectedDays.length})
                                                </Button>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 bg-white dark:bg-slate-900/40">
                                            <Calendar mode="multiple" selected={selectedDays} onSelect={setSelectedDays} />
                                        </div>
                                        {selectedDays && selectedDays.length > 0 && (
                                            <div className="max-h-28 overflow-y-auto p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-wrap gap-1.5">
                                                {selectedDays.map((d) => (
                                                    <Badge key={d.toISOString()} variant="outline" className="text-[10px] gap-1 pr-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono">
                                                        {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedDays((prev) => (prev ?? []).filter((x) => x.getTime() !== d.getTime()))}
                                                            aria-label="Remove day"
                                                            className="hover:text-rose-500 transition-colors"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {impactDetails && (
                                    <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 space-y-2.5 shadow-xs">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-200">
                                                <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                                <span>Real-Time Impact Breakdown</span>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                                {impactDetails.venueCount} Rooms · {impactDetails.dayCount} Days
                                            </Badge>
                                        </div>

                                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                                            {impactDetails.scopeNote}
                                        </p>

                                        {/* Affected Rooms List */}
                                        <div className="space-y-1 pt-1.5 border-t border-blue-200/60 dark:border-blue-800/50">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                                Affected Rooms ({impactDetails.venueCount}):
                                            </span>
                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                                {allFacilitiesChecked && mode === 'exam_period' ? (
                                                    <Badge variant="outline" className="text-[10px] bg-blue-100/80 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700 font-semibold">
                                                        All Campus Classrooms, Labs & Auditoriums ({facilities.length})
                                                    </Badge>
                                                ) : (
                                                    <>
                                                        {impactDetails.affectedRooms.map((room) => (
                                                            <Badge key={room.id} variant="outline" className="text-[10px] bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800 font-mono">
                                                                {room.name} ({room.room_number})
                                                            </Badge>
                                                        ))}
                                                        {impactDetails.remainingRoomCount > 0 && (
                                                            <Badge variant="outline" className="text-[10px] bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold">
                                                                + {impactDetails.remainingRoomCount} more room{impactDetails.remainingRoomCount === 1 ? '' : 's'}
                                                            </Badge>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Affected Classes & Reservations Impact Details */}
                                        <div className="space-y-1.5 text-[11px] text-blue-700/90 dark:text-blue-300/90 border-t border-blue-200/60 dark:border-blue-800/50 pt-2">
                                            <div className="flex items-start gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <strong className="font-semibold text-blue-900 dark:text-blue-100">Affected Class Schedules:</strong> All recurring classes assigned to these rooms during the block will be automatically voided & queued for rebooking.
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-1.5">
                                                <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <strong className="font-semibold text-blue-900 dark:text-blue-100">Affected Room Reservations:</strong> Existing faculty and student reservations matching these dates/rooms will be automatically canceled with email notifications sent.
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 italic pt-1">
                                            {impactDetails.approvalNote}
                                        </p>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full h-11 rounded-lg bg-[#050d36] hover:bg-[#0072bc] dark:bg-[#0072bc] dark:hover:bg-[#005a96] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                                    disabled={submitting || loading}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CalendarPlus className="mr-2 h-4 w-4" />
                                            {isAH ? 'Request' : 'Create'} {mode === 'school_event' ? 'School Event' : 'Exam Block'}
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-500" />
                            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">History & Active Blocks</h2>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{groups.length} entr{groups.length === 1 ? 'y' : 'ies'}</span>
                    </div>

                    {loading ? (
                        <SkeletonList />
                    ) : groups.length === 0 ? (
                        <Card className="bg-white dark:bg-[#111827] border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden p-6 sm:p-8">
                            <div className="flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-14 h-14 bg-blue-500/10 dark:bg-blue-400/10 rounded-2xl flex items-center justify-center border border-blue-200/50 dark:border-blue-800/50">
                                    <CalendarDays className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="space-y-1.5 max-w-md">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">No Schedule Events Active</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Use the form on the left to schedule an institutional event or block campus facilities for an exam period.
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 w-full max-w-md grid grid-cols-2 gap-3 text-left">
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">School Event</span>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Blocks specific venues for designated dates and times.</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Exam Period</span>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Blocks all facilities full-day for academic examinations.</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {groups.map((group) => {
                                const { actions, readOnlyMessage } = resolveGroupActions(group, viewerRole, user?.id ?? '')
                                const busy = busyGroupId === (group.group_id ?? group.booking_ids?.[0])
                                const key = group.group_id ?? group.booking_ids?.[0] ?? group.event_name
                                return (
                                    <Card key={key} className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                                <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Building2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                                                </div>
                                                <div className="space-y-1.5 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{group.event_name}</h3>
                                                        {group.block_category && (
                                                            <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 border-slate-200 dark:border-slate-700">
                                                                {group.block_category === 'exam_period' ? 'Exam Period' : 'School Event'}
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className={cn('text-[10px] font-semibold tracking-wide px-2 py-0.5 border rounded-md', STATUS_BADGE[group.current_status])}>
                                                            {STATUS_LABEL[group.current_status] ?? bookingStatusLabel(group.current_status)}
                                                        </Badge>
                                                    </div>
                                                    {group.created_by_name && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">by {group.created_by_name}</p>
                                                    )}
                                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                        {group.dates.length} day{group.dates.length === 1 ? '' : 's'} · {group.facilities.length} facilit{group.facilities.length === 1 ? 'y' : 'ies'}
                                                    </p>

                                                    {/* Affected Rooms Badges */}
                                                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-0.5">Rooms:</span>
                                                        {group.facilities.length === facilities.length && facilities.length > 0 ? (
                                                            <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-semibold">
                                                                All Campus Facilities ({facilities.length})
                                                            </Badge>
                                                        ) : (
                                                            <>
                                                                {group.facilities.slice(0, 4).map((f) => (
                                                                    <Badge key={f.id} variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-mono">
                                                                        {f.room_number || f.name}
                                                                    </Badge>
                                                                ))}
                                                                {group.facilities.length > 4 && (
                                                                    <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-medium">
                                                                        +{group.facilities.length - 4} more
                                                                    </Badge>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Affected Classes & Reservations Impact Summary — clickable */}
                                                    {group.current_status !== 'pending' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleDisplaced(group.group_id)}
                                                            className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                        >
                                                            <span className="flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                Class Schedules Voided & Rebooked
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                                Room Reservations Canceled
                                                            </span>
                                                            <ChevronDown className={cn('w-3 h-3 transition-transform', expandedGroupId === group.group_id && 'rotate-180')} />
                                                        </button>
                                                    )}

                                                    {/* Expanded displaced items */}
                                                    {expandedGroupId === group.group_id && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                                            {loadingDisplaced ? (
                                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading displaced items…
                                                                </div>
                                                            ) : displacedData ? (
                                                                <div className="space-y-3">
                                                                    {/* Displaced Bookings */}
                                                                    {displacedData.bookings.length > 0 && (
                                                                        <div>
                                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1.5">
                                                                                Displaced Reservations ({displacedData.bookings.length})
                                                                            </p>
                                                                            <div className="space-y-1.5">
                                                                                {displacedData.bookings.map((b: any) => (
                                                                                    <div key={b.id} className="flex items-center gap-2 text-[11px] p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                                                                                        <span className="font-mono font-semibold text-rose-700 dark:text-rose-300">{b.booking_reference}</span>
                                                                                        <span className="text-slate-500">·</span>
                                                                                        <span className="text-slate-600 dark:text-slate-400">{b.user_name}</span>
                                                                                        <span className="text-slate-500">·</span>
                                                                                        <span className="text-slate-500">{b.original_date}</span>
                                                                                        <span className="text-slate-500">·</span>
                                                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                                                        <span className="text-slate-500">{b.original_start}–{b.original_end}</span>
                                                                                        <Badge variant="outline" className={cn('text-[9px] ml-auto', b.current_status === 'awaiting_reschedule' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700')}>
                                                                                            {b.current_status === 'awaiting_reschedule' ? 'Awaiting Reschedule' : b.current_status}
                                                                                        </Badge>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Voided Class Schedules */}
                                                                    {displacedData.class_schedules.length > 0 && (
                                                                        <div>
                                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">
                                                                                Voided Class Sessions ({displacedData.class_schedules.length})
                                                                            </p>
                                                                            <div className="space-y-1.5">
                                                                                {displacedData.class_schedules.map((cs: any) => (
                                                                                    <div key={cs.id} className="flex items-center gap-2 text-[11px] p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                                                                                        <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">{cs.course_code}</span>
                                                                                        {cs.section && <span className="text-slate-500">§{cs.section}</span>}
                                                                                        <span className="text-slate-500">·</span>
                                                                                        <span className="text-slate-600 dark:text-slate-400">{cs.instructor_name}</span>
                                                                                        <span className="text-slate-500">·</span>
                                                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                                                        <span className="text-slate-500">{cs.original_time}</span>
                                                                                        <Badge variant="outline" className={cn('text-[9px] ml-auto', cs.reschedule_status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : cs.reschedule_status === 'rescheduled' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700')}>
                                                                                            {cs.reschedule_status}
                                                                                        </Badge>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {displacedData.bookings.length === 0 && displacedData.class_schedules.length === 0 && (
                                                                        <p className="text-xs text-slate-400 italic">No displaced items found.</p>
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )}

                                                    {readOnlyMessage && (
                                                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-1">{readOnlyMessage}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {actions.length > 0 && (
                                                <div className="flex items-center gap-1.5 justify-end border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 pt-3 sm:pt-0">
                                                    {actions.map((action) => {
                                                        const meta = ACTION_LABEL[action]
                                                        const Icon = meta.icon
                                                        const destructive = ['reject', 'legacy_reject', 'cancel', 'legacy_cancel', 'request_cancellation', 'decline_cancellation', 'withdraw', 'legacy_delete'].includes(action)
                                                        return (
                                                            <Button
                                                                key={action}
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={busy}
                                                                onClick={() =>
                                                                    destructive
                                                                        ? confirmAction(group, action, meta.label, `Are you sure you want to ${meta.label.toLowerCase()} "${group.event_name}"? This will restore voided class schedules and room reservations.`)
                                                                        : runGroupAction(group, action)
                                                                }
                                                                aria-label={`${meta.label}: ${group.event_name}`}
                                                                className={cn('h-9 px-3 text-xs font-semibold rounded-lg', meta.tone)}
                                                            >
                                                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Icon className="h-3.5 w-3.5 mr-1" />}
                                                                {meta.label}
                                                            </Button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-[#111827] max-w-[95vw] sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-white">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            {confirmDialog.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{confirmDialog.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-5 flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="h-10 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-800 m-0">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDialog.onConfirm} className="h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider m-0">
                            Confirm Action
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
