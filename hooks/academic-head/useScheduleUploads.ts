'use client'

/**
 * useScheduleUploads — Fetches and manages schedule upload batches
 * for the Academic Head dashboard.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────

export interface ScheduleUploadSummary {
    id: string
    upload_mode: string
    upload_status: string
    source_file_name: string | null
    total_entries: number
    valid_entries_count: number
    warning_entries_count: number
    error_entries_count: number
    conflict_count: number
    batch_effective_date: string | null
    batch_effective_end_date: string | null
    submitted_at: string | null
    reviewed_at: string | null
    review_notes: string | null
    created_at: string
    departments: { id: string; name: string } | null
    users: { full_name: string } | null
    academic_terms: { id: string; term_name: string } | null
}

export interface ScheduleStagingEntry {
    id: string
    schedule_upload_id: string
    entry_source: string
    row_number: number | null
    facility_id: string | null
    facility_name_raw: string
    facility_match_confidence: number | null
    course_code: string
    course_name: string
    section: string
    session_type: string | null
    instructor_id: string | null
    instructor_name: string
    day_of_week: number
    start_time: string
    end_time: string
    effective_start_date: string | null
    effective_end_date: string | null
    validation_status: string
    validation_errors: any[]
    validation_warnings: any[]
    has_internal_conflict: boolean
    has_external_conflict: boolean
    academic_head_review_status: string
    academic_head_review_notes: string | null
    uses_custom_dates: boolean
    is_published: boolean
    facilities?: { name: string; room_number: string } | null
}

// ── Hook ─────────────────────────────────────────────────

export function useScheduleUploads(filters?: { status?: string | string[]; termId?: string }) {
    const [uploads, setUploads] = useState<ScheduleUploadSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const supabase = useMemo(() => createClient(), [])

    const fetchUploads = useCallback(async () => {
        setLoading(true)
        setError(null)

        let query = supabase
            .from('schedule_uploads')
            .select(`
        id,
        upload_mode,
        upload_status,
        source_file_name,
        total_entries,
        valid_entries_count,
        warning_entries_count,
        error_entries_count,
        conflict_count,
        batch_effective_date,
        batch_effective_end_date,
        submitted_at,
        reviewed_at,
        review_notes,
        created_at,
        departments(id, name),
        users!schedule_uploads_uploaded_by_fkey(full_name),
        academic_terms(id, term_name)
      `)
            .order('created_at', { ascending: false })

        if (filters?.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('upload_status', filters.status)
            } else {
                query = query.eq('upload_status', filters.status)
            }
        }
        if (filters?.termId) {
            query = query.eq('academic_term_id', filters.termId)
        }

        const { data, error: fetchErr } = await query

        if (fetchErr) {
            setError(fetchErr.message)
        } else {
            setUploads((data as any) ?? [])
        }
        setLoading(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, Array.isArray(filters?.status) ? filters?.status.join(',') : filters?.status, filters?.termId])

    useEffect(() => {
        fetchUploads()
    }, [fetchUploads])

    return { uploads, loading, error, refetch: fetchUploads }
}

// ── Hook: single upload entries ──────────────────────────

export function useScheduleEntries(uploadId: string | null) {
    const [entries, setEntries] = useState<ScheduleStagingEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fetchEntries = useCallback(async () => {
        if (!uploadId) return
        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`/api/schedules/uploads/${uploadId}/entries`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch entries')
            }

            setEntries(data.entries ?? [])
        } catch (err: any) {
            setError(err.message)
            setEntries([])
        }
        setLoading(false)
    }, [uploadId])

    useEffect(() => {
        fetchEntries()
    }, [fetchEntries])

    // Edit single entry
    const editEntry = useCallback(async (entryId: string, data: any) => {
        if (!uploadId) return
        setError(null)
        try {
            const res = await fetch(`/api/schedules/review/${uploadId}/entries/${entryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            const updated = await res.json()
            if (!res.ok) throw new Error(updated.error || 'Failed to update entry')

            // Re-fetch to get fresh validation status and populated relations
            await fetchEntries()
            return updated
        } catch (err: any) {
            setError(err.message)
            throw err
        }
    }, [uploadId, fetchEntries])

    // Batch review action
    const batchReview = useCallback(async (
        entryIds: string[],
        status: 'academic_head_approved' | 'academic_head_flagged' | 'academic_head_rejected',
        notes?: string,
    ) => {
        const res = await fetch(`/api/schedules/review/${uploadId}/batch-review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                actions: entryIds.map(id => ({ entry_id: id, action: status, notes })),
            }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Batch review failed')
        await fetchEntries()
    }, [uploadId, fetchEntries])

    // Single entry review
    const reviewEntry = useCallback(async (
        entryId: string,
        status: 'academic_head_approved' | 'academic_head_flagged' | 'academic_head_rejected',
        notes?: string,
    ) => {
        return batchReview([entryId], status, notes)
    }, [batchReview])

    // Split one entry into two sessions
    const splitEntry = useCallback(async (
        entryId: string,
        session1: { day_of_week: number; start_time: string; end_time: string; facility_name_raw: string },
        session2: { day_of_week: number; start_time: string; end_time: string; facility_name_raw: string },
    ) => {
        if (!uploadId) return
        setError(null)
        try {
            const res = await fetch(`/api/schedules/review/${uploadId}/entries/split`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry_id: entryId, session1, session2 }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Split failed')
            await fetchEntries()
            return data
        } catch (err: any) {
            setError(err.message)
            throw err
        }
    }, [uploadId, fetchEntries])

    // Delete single entry
    const deleteEntry = useCallback(async (entryId: string) => {
        if (!uploadId) return
        setError(null)
        try {
            const res = await fetch(`/api/schedules/review/${uploadId}/entries/${entryId}`, {
                method: 'DELETE',
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Delete failed')
            await fetchEntries()
            return data
        } catch (err: any) {
            setError(err.message)
            throw err
        }
    }, [uploadId, fetchEntries])

    // Optimistic in-place update — no network call, no loading flash
    const patchEntry = useCallback((entryId: string, patch: Partial<ScheduleStagingEntry>) => {
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...patch } : e))
    }, [])

    return { entries, loading, error, refetch: fetchEntries, batchReview, reviewEntry, editEntry, splitEntry, deleteEntry, patchEntry }
}
