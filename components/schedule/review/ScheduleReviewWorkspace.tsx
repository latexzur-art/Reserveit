'use client'

/**
 * ScheduleReviewWorkspace — shared schedule-upload review surface.
 * Extracted from the academic-head review page (Phase 4); parameterized so
 * other roles (program head, Phase 6) can adopt it via capability props.
 */

import { useState, useMemo, useCallback, useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useScheduleEntries, useScheduleUploads } from '@/hooks/academic-head/useScheduleUploads'
import { ConflictDrawer } from '@/components/schedule/ConflictDrawer'
import { toast } from 'sonner'
import { TIME_SLOTS, timeToMins } from './_utils/time'
import { useScheduleReviewFilters } from '@/hooks/schedule/useScheduleReviewFilters'
import { EditStagingEntryModal } from './_components/EditStagingEntryModal'
import { ScheduleReviewHeader } from './_components/ScheduleReviewHeader'
import { ScheduleReviewSummaryCards } from './_components/ScheduleReviewSummaryCards'
import { PublishedConflictWarning } from './_components/PublishedConflictWarning'
import { FilterAndBatchActionBar } from './_components/FilterAndBatchActionBar'
import { ScheduleEntriesTable } from './_components/ScheduleEntriesTable'
import { PublishSection } from './_components/PublishSection'
import { SubmitWorkflow } from './_components/SubmitWorkflow'
import { ConfirmationModal } from './_components/ConfirmationModal'

export interface ScheduleReviewCapabilities {
    /** Academic Head-style approve & publish to live schedules. */
    canPublish?: boolean
    /** Rollback published entries back to staging. */
    canRollback?: boolean
    /** Program-head: show submit-for-review workflow instead of publish. */
    canSubmit?: boolean
}

export interface ScheduleReviewWorkspaceProps {
    uploadId: string
    /** Where the back arrow leads — role-specific review list page. */
    backHref: string
    capabilities?: ScheduleReviewCapabilities
    /**
     * 'review' (default): filter tabs show academic head review statuses (academic head).
     * 'validation': filter tabs show validation statuses (program head).
     */
    filterMode?: 'review' | 'validation'
    /**
     * Called when the user clicks Submit for Review. Must throw on failure so
     * the workspace can show a toast error. Only used when capabilities.canSubmit.
     */
    onSubmit?: () => Promise<void>
    /**
     * Override the built-in EditStagingEntryModal with a custom render.
     * Receive the entry, the uploadId, and the onClose(saved?) callback.
     */
    renderEditModal?: (
        entry: any,
        uploadId: string,
        onClose: (saved?: boolean) => void
    ) => ReactNode
}

export function ScheduleReviewWorkspace({
    uploadId,
    backHref,
    capabilities = { canPublish: true, canRollback: true },
    filterMode = 'review',
    onSubmit,
    renderEditModal,
}: ScheduleReviewWorkspaceProps) {
    const searchParams = useSearchParams()

    const { entries, loading, refetch, batchReview, reviewEntry, patchEntry, deleteEntry } = useScheduleEntries(uploadId)
    const { uploads } = useScheduleUploads()
    const upload = useMemo(() => uploads.find(u => u.id === uploadId), [uploads, uploadId])

    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [reviewNotes, setReviewNotes] = useState('')
    const [actionLoading, setActionLoading] = useState(false)
    const [filterStatus, setFilterStatus] = useState<string>('')
    const [showPublish, setShowPublish] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [publishResult, setPublishResult] = useState<any>(null)
    const [publishError, setPublishError] = useState<string | null>(null)
    const [impactCount, setImpactCount] = useState(0)
    const [editModal, setEditModal] = useState<any>(null)
    const [drawerEntry, setDrawerEntry] = useState<any>(null)
    const [autoFixing, setAutoFixing] = useState<string | null>(null)
    const [autoFixErrors, setAutoFixErrors] = useState<Record<string, string>>({})
    const [autoFixingAll, setAutoFixingAll] = useState(false)
    const [confirmAction, setConfirmAction] = useState<{ type: string; id?: string; label: string; action: () => Promise<void> } | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        const initialFilter = searchParams.get('filter')
        if (initialFilter) {
            setFilterStatus(initialFilter)
        }
    }, [searchParams])


    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAll = () => {
        if (selected.size === filtered.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(filtered.map(e => e.id)))
        }
    }

    const handleBatchAction = useCallback(async (action: 'academic_head_approved' | 'academic_head_flagged' | 'academic_head_rejected') => {
        if (selected.size === 0) return
        setActionLoading(true)
        try {
            await batchReview(Array.from(selected), action, reviewNotes || undefined)
            setSelected(new Set())
            setReviewNotes('')
        } catch (err) {
            console.error('Review action failed:', err)
        }
        setActionLoading(false)
    }, [selected, batchReview, reviewNotes])

    const handleApproveAndPublish = useCallback(async () => {
        if (selected.size === 0) return
        setActionLoading(true)
        try {
            await batchReview(Array.from(selected), 'academic_head_approved', reviewNotes || undefined)
            setSelected(new Set())
            setReviewNotes('')
            setPublishing(true)
            setPublishError(null)
            const res = await fetch(`/api/schedules/review/${uploadId}/publish`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setPublishResult(data)
            refetch()
        } catch (err: any) {
            setPublishError(err.message)
            console.error('Approve & publish failed:', err)
        }
        setPublishing(false)
        setActionLoading(false)
    }, [selected, batchReview, reviewNotes, uploadId, refetch])

    const handleBatchRollback = useCallback(async () => {
        if (selected.size === 0) return
        setConfirmAction({
            type: 'batch-rollback',
            label: `Rollback ${selected.size} selected entries?`,
            action: async () => {
                setActionLoading(true)
                try {
                    const res = await fetch(`/api/schedules/review/${uploadId}/rollback`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ entryIds: Array.from(selected) })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    setSelected(new Set())
                    refetch()
                } catch (err: any) {
                    alert(err.message)
                    console.error('Rollback action failed:', err)
                }
                setActionLoading(false)
            }
        })
    }, [selected, uploadId, refetch])

    const handleSubmit = useCallback(async () => {
        if (!onSubmit) return
        setSubmitting(true)
        try {
            await onSubmit()
            toast.success('Schedule submitted for academic head review.')
            await refetch()
        } catch (err: any) {
            toast.error(err?.message ?? 'Submit failed')
        }
        setSubmitting(false)
    }, [onSubmit, refetch])

    const handlePublish = useCallback(async () => {
        setPublishing(true)
        setPublishError(null)
        try {
            const res = await fetch(`/api/schedules/review/${uploadId}/publish`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setPublishResult(data)
            refetch()
        } catch (err: any) {
            setPublishError(err.message)
            console.error('Publish failed:', err)
        }
        setPublishing(false)
    }, [uploadId, refetch])

    const {
        counts,
        validationCounts,
        hasApprovedErrors,
        hasPublishedSelected,
        publishedConflicts,
        failedPublishRows,
        filtered,
        problematicEntries,
        conflictedEntries,
        hasConflictSelected,
    } = useScheduleReviewFilters(entries, filterMode, filterStatus, selected, publishResult)

    const [rollingBackConflicts, setRollingBackConflicts] = useState(false)
    const handleRollbackConflicts = useCallback(async () => {
        if (publishedConflicts.length === 0) return
        setConfirmAction({
            type: 'rollback-conflicts',
            label: `Roll back ${publishedConflicts.length} published entries that have live schedule conflicts?`,
            action: async () => {
                setRollingBackConflicts(true)
                try {
                    const res = await fetch(`/api/schedules/review/${uploadId}/rollback`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ entryIds: publishedConflicts.map(e => e.id) }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    refetch()
                } catch (err: any) {
                    alert(err.message)
                }
                setRollingBackConflicts(false)
            }
        })
    }, [publishedConflicts, uploadId, refetch])

    const handleAutoFix = useCallback(async (entryId: string) => {
        setAutoFixing(entryId)
        setAutoFixErrors(prev => { const next = { ...prev }; delete next[entryId]; return next })
        try {
            const res = await fetch(`/api/schedules/review/${uploadId}/suggest-facility`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry_id: entryId }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'No available room found')
            // Optimistic in-place update — no refetch, no table flicker
            patchEntry(entryId, {
                facility_id: data.facility.id,
                facility_name_raw: data.facility.name,
                facility_match_confidence: 1.0,
                facilities: { name: data.facility.name, room_number: data.facility.room_number },
                validation_status: data.validation_status,
            })
        } catch (err: any) {
            setAutoFixErrors(prev => ({ ...prev, [entryId]: err.message ?? 'No available room found' }))
        }
        setAutoFixing(null)
    }, [uploadId, patchEntry])

    const handleAutoFixAll = useCallback(async () => {
        setAutoFixingAll(true)
        // Fire all requests in parallel — each patches its own row on completion
        await Promise.allSettled(
            problematicEntries.map(entry => handleAutoFix(entry.id))
        )
        setAutoFixingAll(false)
    }, [problematicEntries, handleAutoFix])

    const [resolvingConflicts, setResolvingConflicts] = useState(false)
    const [resolveErrors, setResolveErrors] = useState<Record<string, string>>({})

    const resolveConflict = useCallback(async (entry: typeof entries[0], mode: 'room' | 'time' | 'both') => {
        if (!entry.start_time || !entry.end_time) {
            throw new Error('Cannot auto-resolve without valid start and end times')
        }

        // Extract type keywords from the current room name for type-matching
        const roomName = (entry.facilities?.name ?? entry.facility_name_raw ?? '').toLowerCase()
        const typeKeywords = ['computer', 'chemistry', 'physics', 'biology', 'library', 'mph', 'lecture', 'lab', 'conference']
        const matchedType = typeKeywords.find(k => roomName.includes(k)) ?? null

        const durationMins = timeToMins(entry.end_time.slice(0, 5)) - timeToMins(entry.start_time.slice(0, 5))

        // Helper: fetch available rooms for a slot, optionally preferring a type
        const findRoom = async (day: number, start: string, end: string, specificRoomId?: string) => {
            const params = new URLSearchParams({
                day_of_week: String(day),
                start_time: start,
                end_time: end,
                exclude_entry_id: entry.id,
            })
            if (entry.instructor_id) params.append('instructor_id', entry.instructor_id)
            if (entry.instructor_name) params.append('instructor_name_raw', entry.instructor_name)
            if (entry.section) params.append('section', entry.section)
            const res = await fetch(`/api/schedules/slot-availability?${params}`)
            if (!res.ok) return null
            const data = await res.json()
            const avail: any[] = (data.facilities ?? []).filter((f: any) => f.available)
            if (avail.length === 0) return null
            if (specificRoomId) {
                return avail.find((f: any) => f.id === specificRoomId) ?? null
            }
            // Prefer same room type; fall back to any available
            const typed = matchedType ? avail.find(f => f.name.toLowerCase().includes(matchedType)) : null
            return typed ?? avail[0]
        }

        const currentStart = entry.start_time.slice(0, 5)
        const currentEnd = entry.end_time.slice(0, 5)
        let room = null
        let chosenStart = currentStart
        let chosenEnd = currentEnd

        if (mode === 'room' || mode === 'both') {
            // Try current time slot first (just a different room)
            room = await findRoom(entry.day_of_week, currentStart, currentEnd)
        }

        // If no room at current time, and mode allows time change, scan other start times
        if (!room && (mode === 'time' || mode === 'both')) {
            // Sort start times by proximity to the original start time to minimize schedule disruption
            const currentStartMins = timeToMins(currentStart)
            const sortedStarts = [...TIME_SLOTS.filter(t => t !== '21:00')].sort((a, b) => {
                return Math.abs(timeToMins(a) - currentStartMins) - Math.abs(timeToMins(b) - currentStartMins)
            })

            for (const start of sortedStarts) {
                if (start === currentStart) continue // Already checked
                
                const endMins = timeToMins(start) + durationMins
                if (endMins > 21 * 60) continue // Skip if it goes past 9 PM
                
                const endH = Math.floor(endMins / 60)
                const endM = endMins % 60
                const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

                // If mode is 'time', we must keep the SAME room
                const specificRoomId = mode === 'time' ? (entry.facility_id ?? undefined) : undefined
                room = await findRoom(entry.day_of_week, start, end, specificRoomId)
                if (room) { chosenStart = start; chosenEnd = end; break }
            }
        }

        if (!room) throw new Error(`No available slot/room found (Mode: ${mode})`)

        await fetch(`/api/schedules/review/${uploadId}/entries/${entry.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...entry,
                start_time: chosenStart + ':00',
                end_time: chosenEnd + ':00',
                facility_name_raw: room.name,
            }),
        })
    }, [uploadId])

    const handleAutoResolveConflicts = useCallback(async (mode: 'room' | 'time' | 'both') => {
        setResolvingConflicts(true)
        setResolveErrors({})
        const errs: Record<string, string> = {}
        for (const entry of conflictedEntries) {
            try {
                await resolveConflict(entry, mode)
            } catch (err: any) {
                errs[entry.id] = err.message ?? 'Failed'
            }
        }
        setResolveErrors(errs)
        await fetch(`/api/schedules/review/${uploadId}/redetect-conflicts`, { method: 'POST' })
        refetch()
        setResolvingConflicts(false)
    }, [conflictedEntries, resolveConflict, uploadId, refetch])

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <ScheduleReviewHeader backHref={backHref} upload={upload} entryCount={entries.length} />

            {/* Summary cards */}
            <ScheduleReviewSummaryCards counts={counts} />

            {/* Published conflict warning */}
            <PublishedConflictWarning
                publishedConflicts={publishedConflicts}
                rollingBackConflicts={rollingBackConflicts}
                onRollbackConflicts={handleRollbackConflicts}
            />

            {/* Filter + Batch Actions & Table Container */}
            <div className="flex flex-col shadow-sm">
                <FilterAndBatchActionBar
                filterMode={filterMode}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                counts={counts}
                validationCounts={validationCounts}
                failedPublishRows={failedPublishRows}
                entries={entries}
                problematicEntries={problematicEntries}
                conflictedEntries={conflictedEntries}
                selected={selected}
                hasPublishedSelected={hasPublishedSelected}
                hasConflictSelected={hasConflictSelected}
                reviewNotes={reviewNotes}
                setReviewNotes={setReviewNotes}
                actionLoading={actionLoading}
                publishing={publishing}
                autoFixing={autoFixing}
                autoFixingAll={autoFixingAll}
                resolvingConflicts={resolvingConflicts}
                canPublish={!!capabilities.canPublish}
                onBatchAction={handleBatchAction}
                onApproveAndPublish={handleApproveAndPublish}
                onBatchRollback={handleBatchRollback}
                onAutoFixAll={handleAutoFixAll}
                onAutoResolveConflicts={handleAutoResolveConflicts}
            />

            {/* Entries Table */}
            <ScheduleEntriesTable
                loading={loading}
                filtered={filtered}
                totalEntries={entries.length}
                filterActive={filterStatus !== ''}
                selected={selected}
                failedPublishRows={failedPublishRows}
                autoFixing={autoFixing}
                autoFixingAll={autoFixingAll}
                autoFixErrors={autoFixErrors}
                uploadId={uploadId}
                onSelectAll={selectAll}
                onToggleSelect={toggleSelect}
                onEdit={(entry) => setEditModal(entry)}
                onViewConflict={(entry) => setDrawerEntry(entry)}
                onAutoFix={handleAutoFix}
                onDelete={(entry) => setConfirmAction({
                    type: 'delete-single',
                    label: `Delete row for ${entry.course_code} ${entry.section}?`,
                    action: async () => {
                        setActionLoading(true)
                        try {
                            await deleteEntry(entry.id)
                        } catch (err: any) {
                            alert(err.message)
                        }
                        setActionLoading(false)
                    }
                })}
                onRollback={(entry) => setConfirmAction({
                    type: 'rollback-single',
                    label: `Rollback ${entry.course_code} ${entry.section} from live schedules?`,
                    action: async () => {
                        try {
                            const res = await fetch(`/api/schedules/review/${uploadId}/rollback`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ entryIds: [entry.id] })
                            })
                            if (!res.ok) throw new Error((await res.json()).error)
                            refetch()
                        } catch (err: any) {
                            alert(err.message)
                        }
                    }
                })}
                    refetch={refetch}
                />
            </div>

            {/* Publish Section — only for roles with publish capability (academic head) */}
            {capabilities.canPublish && (
            <PublishSection
                counts={counts}
                showPublish={showPublish}
                setShowPublish={setShowPublish}
                publishResult={publishResult}
                publishError={publishError}
                publishing={publishing}
                hasApprovedErrors={hasApprovedErrors}
                failedPublishRows={failedPublishRows}
                impactCount={impactCount}
                setImpactCount={setImpactCount}
                setFilterStatus={setFilterStatus}
                uploadId={uploadId}
                onPublish={handlePublish}
            />
            )}

            {capabilities.canSubmit && (
                <SubmitWorkflow
                    upload={upload}
                    validationCounts={validationCounts}
                    submitting={submitting}
                    onSubmit={handleSubmit}
                />
            )}

            {
                editModal && (
                    renderEditModal
                        ? renderEditModal(
                            editModal,
                            uploadId,
                            (saved?: boolean) => { setEditModal(null); if (saved) refetch() }
                          )
                        : (
                            <EditStagingEntryModal
                                uploadId={uploadId}
                                entry={editModal}
                                onClose={(saved?: boolean) => { setEditModal(null); if (saved) refetch() }}
                            />
                          )
                )
            }

            {/* Conflict Drawer */}
            {drawerEntry && (
                <ConflictDrawer
                    entry={drawerEntry}
                    uploadId={uploadId}
                    onClose={() => setDrawerEntry(null)}
                    onEntryUpdated={() => refetch()}
                />
            )}
            <ConfirmationModal
                confirmAction={confirmAction}
                onCancel={() => setConfirmAction(null)}
                onConfirm={async () => {
                    const action = confirmAction!.action
                    setConfirmAction(null)
                    await action()
                }}
            />
        </div >
    )
}



