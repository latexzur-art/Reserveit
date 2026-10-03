'use client'

/**
 * ConflictDrawer — Slide-out panel showing detailed conflict info for a staging entry.
 * Supports inline editing of room and time with live re-validation.
 */

import { useState, useEffect, useCallback } from 'react'
import {
    X,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
    MapPin,
    Clock,
    User,
    ChevronRight,
    Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduleStagingEntry } from '@/hooks/academic-head/useScheduleUploads'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface ConflictDetail {
    entry_id: string
    conflict_type: 'internal' | 'external' | 'cross_department'
    conflicting_entry_id?: string
    conflicting_schedule_id?: string
    facility_id: string
    day_of_week: number
    start_time: string
    end_time: string
    name?: string
    course_code?: string
    course_name?: string
    section?: string
}

interface ConflictDrawerProps {
    entry: ScheduleStagingEntry | null
    uploadId: string
    onClose: () => void
    onEntryUpdated: () => void
}

export function ConflictDrawer({ entry, uploadId, onClose, onEntryUpdated }: ConflictDrawerProps) {
    const [conflicts, setConflicts] = useState<ConflictDetail[]>([])
    const [loadingConflicts, setLoadingConflicts] = useState(false)
    const [availableFacilities, setAvailableFacilities] = useState<{ id: string; name: string; room_number: string; available: boolean }[]>([])
    const [loadingFacilities, setLoadingFacilities] = useState(false)

    // Inline edit state
    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState({
        facility_name_raw: '',
        day_of_week: 0,
        start_time: '',
        end_time: '',
    })
    const [saving, setSaving] = useState(false)
    const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)

    // Fetch conflict details when entry changes
    const fetchConflictDetails = useCallback(async () => {
        if (!entry) return
        setLoadingConflicts(true)
        setSaveResult(null)

        try {
            // We use the entry's existing conflict data from the staging table
            // and also try to get enriched info
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()

            const fetchedConflicts: ConflictDetail[] = []

            // Internal conflicts — other entries in this upload that overlap
            if (entry.has_internal_conflict && (entry as any).conflict_entry_ids?.length > 0) {
                const { data: conflictEntries } = await supabase
                    .from('schedule_entries_staging')
                    .select('id, course_code, course_name, section, facility_id, day_of_week, start_time, end_time, facilities(name)')
                    .in('id', (entry as any).conflict_entry_ids)

                for (const ce of (conflictEntries ?? [])) {
                    fetchedConflicts.push({
                        entry_id: entry.id,
                        conflict_type: 'internal',
                        conflicting_entry_id: ce.id,
                        facility_id: ce.facility_id ?? '',
                        day_of_week: ce.day_of_week,
                        start_time: ce.start_time,
                        end_time: ce.end_time,
                        name: (ce as any).facilities?.name ?? '',
                        course_code: ce.course_code,
                        course_name: ce.course_name,
                        section: ce.section,
                    })
                }
            }

            // External conflicts — live schedules that overlap
            if (entry.has_external_conflict && (entry as any).conflict_schedule_ids?.length > 0) {
                const { data: conflictSchedules } = await supabase
                    .from('class_schedules')
                    .select('id, course_code, course_name, section, instructor_name, facility_id, day_of_week, start_time, end_time, facilities(name), departments(name, code)')
                    .in('id', (entry as any).conflict_schedule_ids)

                for (const cs of (conflictSchedules ?? [])) {
                    fetchedConflicts.push({
                        entry_id: entry.id,
                        conflict_type: 'external',
                        conflicting_schedule_id: cs.id,
                        facility_id: cs.facility_id ?? '',
                        day_of_week: cs.day_of_week,
                        start_time: cs.start_time,
                        end_time: cs.end_time,
                        name: `${(cs as any).facilities?.name ?? ''} (${(cs as any).departments?.code ?? 'Live'})`,
                        course_code: cs.course_code,
                        course_name: cs.course_name,
                        section: cs.section,
                    })
                }
            }

            // Fallback: if we have conflict flags but no IDs, show a generic message
            if (fetchedConflicts.length === 0 && (entry.has_internal_conflict || entry.has_external_conflict)) {
                if (entry.has_internal_conflict) {
                    fetchedConflicts.push({
                        entry_id: entry.id,
                        conflict_type: 'internal',
                        facility_id: entry.facility_id ?? '',
                        day_of_week: entry.day_of_week,
                        start_time: entry.start_time,
                        end_time: entry.end_time,
                        name: 'Same upload',
                        course_code: 'Another entry',
                        course_name: '',
                        section: 'in this upload',
                    })
                }
                if (entry.has_external_conflict) {
                    fetchedConflicts.push({
                        entry_id: entry.id,
                        conflict_type: 'external',
                        facility_id: entry.facility_id ?? '',
                        day_of_week: entry.day_of_week,
                        start_time: entry.start_time,
                        end_time: entry.end_time,
                        name: 'Live schedule',
                        course_code: 'Existing class',
                        course_name: '',
                        section: 'in database',
                    })
                }
            }

            setConflicts(fetchedConflicts)
        } catch (err) {
            console.error('Failed to fetch conflict details:', err)
        }
        setLoadingConflicts(false)
    }, [entry])

    // Fetch available facilities for the current slot
    const fetchAvailableFacilities = useCallback(async (dayOfWeek: number, startTime: string, endTime: string) => {
        if (!startTime || !endTime || !entry) return
        setLoadingFacilities(true)
        try {
            const params = new URLSearchParams({
                day_of_week: String(dayOfWeek),
                start_time: startTime,
                end_time: endTime,
                exclude_entry_id: entry.id,
            })
            const res = await fetch(`/api/schedules/slot-availability?${params}`)
            const data = await res.json()
            setAvailableFacilities(data.facilities ?? [])
        } catch (err) {
            console.error('Failed to fetch available facilities:', err)
        }
        setLoadingFacilities(false)
    }, [entry])

    useEffect(() => {
        if (entry) {
            fetchConflictDetails()
            const start = entry.start_time?.slice(0, 5) ?? ''
            const end = entry.end_time?.slice(0, 5) ?? ''
            setEditForm({
                facility_name_raw: entry.facility_name_raw || (entry as any).facilities?.name || '',
                day_of_week: entry.day_of_week ?? 0,
                start_time: start,
                end_time: end,
            })
            fetchAvailableFacilities(entry.day_of_week ?? 0, start, end)
            setEditMode(false)
            setSaveResult(null)
        }
    }, [entry, fetchConflictDetails, fetchAvailableFacilities])

    // Re-fetch available rooms whenever the time slot changes
    useEffect(() => {
        if (editMode && editForm.start_time && editForm.end_time) {
            fetchAvailableFacilities(editForm.day_of_week, editForm.start_time, editForm.end_time)
        }
    }, [editMode, editForm.day_of_week, editForm.start_time, editForm.end_time, fetchAvailableFacilities])

    const handleSaveEdit = async () => {
        if (!entry) return
        setSaving(true)
        setSaveResult(null)
        try {
            const res = await fetch(`/api/schedules/review/${uploadId}/entries/${entry.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    course_code: entry.course_code,
                    course_name: entry.course_name,
                    section: entry.section,
                    instructor_name: entry.instructor_name,
                    facility_name_raw: editForm.facility_name_raw,
                    day_of_week: editForm.day_of_week,
                    start_time: editForm.start_time + ':00',
                    end_time: editForm.end_time + ':00',
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Update failed')

            const newConflicts = data.conflicts ?? []
            const hasConflicts = newConflicts.length > 0
            const hasErrors = data.validation_status === 'error'

            if (!hasConflicts && !hasErrors) {
                setSaveResult({ success: true, message: 'Conflict resolved! Entry is now valid.' })
            } else if (hasConflicts) {
                setSaveResult({ success: false, message: `Still ${newConflicts.length} conflict(s) remaining.` })
            } else if (hasErrors) {
                setSaveResult({ success: false, message: 'Entry has validation errors.' })
            }

            setEditMode(false)
            onEntryUpdated()

            // Re-fetch conflict details after update
            setTimeout(() => fetchConflictDetails(), 300)
        } catch (err: any) {
            setSaveResult({ success: false, message: err.message })
        }
        setSaving(false)
    }

    if (!entry) return null

    const hasAnyIssue = entry.has_internal_conflict || entry.has_external_conflict
        || entry.validation_status === 'error' || entry.validation_status === 'warning'

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white dark:bg-[#0a0f1e] border-l border-slate-200 dark:border-white/10 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0a0f1e]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/10 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                'p-2 rounded-lg',
                                hasAnyIssue ? 'bg-orange-500/10' : 'bg-emerald-500/10'
                            )}>
                                {hasAnyIssue
                                    ? <AlertTriangle className="h-5 w-5 text-orange-400" />
                                    : <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                }
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {hasAnyIssue ? 'Conflict Details' : 'Entry Details'}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Row {entry.row_number ?? '—'} • {entry.course_code} {entry.section} {entry.course_name ? `- ${entry.course_name}` : ''}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Current Entry Summary */}
                    <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Entry</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{entry.instructor_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    {(entry as any).facilities?.name ?? entry.facility_name_raw}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    {DAY_NAMES[entry.day_of_week]} {entry.start_time?.slice(0, 5)} – {entry.end_time?.slice(0, 5)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Validation Errors */}
                    {entry.validation_errors && entry.validation_errors.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
                                <XCircle className="h-3.5 w-3.5" />
                                Validation Errors ({entry.validation_errors.length})
                            </h3>
                            <div className="space-y-1.5">
                                {entry.validation_errors.map((err: any, i: number) => (
                                    <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
                                        <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs text-red-400 font-medium">{err.field}</span>
                                            <p className="text-xs text-red-400/80">{err.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Validation Warnings */}
                    {entry.validation_warnings && entry.validation_warnings.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Warnings ({entry.validation_warnings.length})
                            </h3>
                            <div className="space-y-1.5">
                                {entry.validation_warnings.map((warn: any, i: number) => (
                                    <div key={i} className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-xs text-amber-400 font-medium">{warn.field}</span>
                                            <p className="text-xs text-amber-400/80">{warn.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conflict List */}
                    {(entry.has_internal_conflict || entry.has_external_conflict) && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Scheduling Conflicts ({loadingConflicts ? '...' : conflicts.length})
                            </h3>
                            {loadingConflicts ? (
                                <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading conflict details...
                                </div>
                            ) : conflicts.length === 0 ? (
                                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-3 text-xs text-emerald-400 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    No active conflicts detected
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {conflicts.map((conflict, i) => (
                                        <div key={i} className="bg-orange-500/5 border border-orange-500/15 rounded-lg px-4 py-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={cn(
                                                    'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                                                    conflict.conflict_type === 'internal'
                                                        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                                        : conflict.conflict_type === 'cross_department'
                                                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
                                                            : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                                )}>
                                                    {conflict.conflict_type === 'internal' ? 'Internal Overlap' :
                                                        conflict.conflict_type === 'cross_department' ? 'Cross-Dept Conflict' :
                                                            'Live Schedule Conflict'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
                                                <ChevronRight className="h-3 w-3 text-orange-500 flex-shrink-0" />
                                                <span className="font-medium">{conflict.course_code} {conflict.section} {conflict.course_name ? `- ${conflict.course_name}` : ''}</span>
                                            </div>
                                            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3-3" />
                                                    {conflict.name || 'Unknown Room'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3-3" />
                                                    {DAY_NAMES[conflict.day_of_week]} {conflict.start_time?.slice(0, 5)}–{conflict.end_time?.slice(0, 5)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* No issues fallback */}
                    {!hasAnyIssue && (
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <div>
                                <p className="text-sm text-emerald-400 font-medium">No Issues Found</p>
                                <p className="text-xs text-emerald-400/70">This entry is valid and conflict-free</p>
                            </div>
                        </div>
                    )}

                    {/* Save Result */}
                    {saveResult && (
                        <div className={cn(
                            'border rounded-lg px-4 py-3 flex items-center gap-3 animate-in fade-in',
                            saveResult.success
                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                : 'bg-red-500/10 border-red-500/20'
                        )}>
                            {saveResult.success
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                : <XCircle className="h-4 w-4 text-red-400" />
                            }
                            <span className={cn('text-xs', saveResult.success ? 'text-emerald-400' : 'text-red-400')}>
                                {saveResult.message}
                            </span>
                        </div>
                    )}

                    {/* Inline Edit Section */}
                    {hasAnyIssue && (
                        <div className="border-t border-slate-200 dark:border-white/10 pt-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-ah-sti-cyan" />
                                    Quick Fix
                                </h3>
                                {!editMode && (
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="text-xs text-blue-600 dark:text-ah-sti-cyan hover:underline transition-colors"
                                    >
                                        Edit Room & Time
                                    </button>
                                )}
                            </div>

                            {editMode ? (
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs text-slate-400">Facility / Room</label>
                                            {!loadingFacilities && (
                                                <span className="text-[11px] text-emerald-400">
                                                    {availableFacilities.filter(f => f.available).length} available
                                                </span>
                                            )}
                                        </div>
                                        <select
                                            value={editForm.facility_name_raw}
                                            onChange={e => setEditForm(p => ({ ...p, facility_name_raw: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500/50 focus:outline-none shadow-sm"
                                            disabled={loadingFacilities}
                                        >
                                            <option value="">
                                                {loadingFacilities ? 'Checking availability…' : '— Select available room —'}
                                            </option>
                                            {availableFacilities.filter(f => f.available).map(f => (
                                                <option key={f.id} value={f.name}>{f.name} ({f.room_number})</option>
                                            ))}
                                            {/* Show current room if not in available list */}
                                            {editForm.facility_name_raw && !availableFacilities.filter(f => f.available).some(f => f.name === editForm.facility_name_raw) && (
                                                <option value={editForm.facility_name_raw} disabled>
                                                    {editForm.facility_name_raw} (unavailable at this time)
                                                </option>
                                            )}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1.5">Day</label>
                                            <select
                                                value={editForm.day_of_week}
                                                onChange={e => setEditForm(p => ({ ...p, day_of_week: parseInt(e.target.value) }))}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500/50 focus:outline-none shadow-sm"
                                            >
                                                {DAY_NAMES.map((d, i) => i === 0 ? null : <option key={i} value={i}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1.5">Start</label>
                                            <input
                                                type="time"
                                                value={editForm.start_time}
                                                onChange={e => setEditForm(p => ({ ...p, start_time: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500/50 focus:outline-none shadow-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1.5">End</label>
                                            <input
                                                type="time"
                                                value={editForm.end_time}
                                                onChange={e => setEditForm(p => ({ ...p, end_time: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500/50 focus:outline-none shadow-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            onClick={() => setEditMode(false)}
                                            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveEdit}
                                            disabled={saving}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shadow-sm"
                                        >
                                            {saving ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Zap className="h-3.5 w-3.5" />
                                            )}
                                            {saving ? 'Re-validating...' : 'Save & Re-validate'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">
                                    Change the room or time to resolve the conflict. The system will immediately re-validate against the database.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
