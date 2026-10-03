import { useMemo } from 'react'

export function useScheduleReviewFilters(
    entries: any[],
    filterMode: 'review' | 'validation',
    filterStatus: string,
    selected: Set<string>,
    publishResult: any,
) {
    // Summary counts
    const counts = useMemo(() => ({
        total: entries.length,
        pending: entries.filter(e => e.academic_head_review_status === 'pending_review' && !e.is_published).length,
        approved: entries.filter(e => e.academic_head_review_status === 'academic_head_approved' && !e.is_published).length,
        flagged: entries.filter(e => e.academic_head_review_status === 'academic_head_flagged' && !e.is_published).length,
        rejected: entries.filter(e => e.academic_head_review_status === 'academic_head_rejected' && !e.is_published).length,
        errors: entries.filter(e => e.validation_status === 'error' && !e.is_published).length,
        conflicts: entries.filter(e => (e.has_internal_conflict || e.has_external_conflict || e.validation_status === 'error') && !e.is_published).length,
        published: entries.filter(e => e.is_published).length,
    }), [entries])

    const validationCounts = useMemo(() => ({
        total: entries.length,
        valid: entries.filter(e => e.validation_status === 'valid' && !e.has_internal_conflict && !e.has_external_conflict).length,
        warnings: entries.filter(e => e.validation_status === 'warning' && !e.has_internal_conflict && !e.has_external_conflict).length,
        errors: entries.filter(e => e.validation_status === 'error').length,
        conflicts: entries.filter(e => e.has_internal_conflict || e.has_external_conflict || e.validation_status === 'error').length,
    }), [entries])

    const hasApprovedErrors = useMemo(() => {
        return entries.some(e => e.academic_head_review_status === 'academic_head_approved' && e.validation_status === 'error')
    }, [entries])

    const hasPublishedSelected = useMemo(() => {
        return Array.from(selected).some(id => entries.find(e => e.id === id)?.is_published)
    }, [selected, entries])

    const publishedConflicts = useMemo(() =>
        entries.filter(e => e.is_published && e.has_external_conflict),
        [entries]
    )

    // If an entry is auto-flagged by the API because it failed to publish (e.g. overlap),
    // it will have specific text in the academic_head_review_notes.
    const failedPublishRows = useMemo(() => {
        const rows = new Set<number>()
        entries.forEach(e => {
            if (e.academic_head_review_status === 'academic_head_flagged' &&
                e.academic_head_review_notes?.includes('Failed to publish') &&
                e.row_number !== null) {
                rows.add(e.row_number)
            }
        })
        return rows
    }, [entries])

    const filtered = useMemo(() => {
        if (filterMode === 'validation') {
            if (!filterStatus) return entries
            if (filterStatus === 'conflict') {
                return entries.filter(e => e.has_internal_conflict || e.has_external_conflict || e.validation_status === 'error')
            }
            if (filterStatus === 'valid') {
                return entries.filter(e => e.validation_status === 'valid' && !e.has_internal_conflict && !e.has_external_conflict)
            }
            if (filterStatus === 'warning') {
                return entries.filter(e => e.validation_status === 'warning' && !e.has_internal_conflict && !e.has_external_conflict)
            }
            return entries.filter(e => e.validation_status === filterStatus)
        }
        // existing 'review' mode logic unchanged below:
        if (filterStatus === 'publish_failed') {
            return entries.filter(e => !e.is_published)
        } else if (filterStatus === 'published') {
            return entries.filter(e => e.is_published)
        } else if (filterStatus) {
            return entries.filter(e => e.academic_head_review_status === filterStatus)
        }
        return entries
    }, [entries, filterStatus, filterMode, failedPublishRows])

    const problematicEntries = useMemo(() =>
        entries.filter(e => !e.is_published && (!e.facility_id || (e.facility_match_confidence !== null && e.facility_match_confidence < 0.8))),
        [entries]
    )

    const conflictedEntries = useMemo(() =>
        entries.filter(e => !e.is_published && (e.has_internal_conflict || e.has_external_conflict || e.validation_status === 'error')),
        [entries]
    )

    const hasConflictSelected = useMemo(() => {
        return Array.from(selected).some(id => {
            const e = entries.find(e => e.id === id)
            return e && (e.validation_status === 'error' || e.has_internal_conflict || e.has_external_conflict)
        })
    }, [selected, entries])

    return {
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
    }
}
