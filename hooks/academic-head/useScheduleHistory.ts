'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────

export interface UploadRecord {
    id: string
    upload_mode: string
    upload_status: string
    source_file_name: string | null
    total_entries: number
    valid_entries_count: number
    warning_entries_count: number
    error_entries_count: number
    conflict_count: number
    submitted_at: string | null
    reviewed_at: string | null
    review_notes: string | null
    created_at: string
    updated_at: string
    academic_term_id: string
    departments: { id: string; name: string; code: string } | null
    users: { id: string; full_name: string; email: string } | null
    academic_terms: { id: string; term_name: string; academic_year: string } | null
}

export interface ScheduleRecord {
    id: string
    course_code: string
    course_name: string
    section: string
    instructor_name: string
    day_of_week: number
    start_time: string
    end_time: string
    version: number
    is_active: boolean
    created_at: string
    updated_at: string
    facility_id: string
    schedule_upload_id: string | null
    superseded_by: string | null
    superseded_at: string | null
    supersede_reason: string | null
    facilities: { name: string; room_number: string } | null
    departments: { id: string; code: string; name: string } | null
}

export interface ModificationEntry {
    original: ScheduleRecord
    modified: ScheduleRecord | null
}

export interface EditScheduleData {
    facility_id?: string
    course_code?: string
    course_name?: string
    section?: string
    instructor_name?: string
    day_of_week?: number
    start_time?: string
    end_time?: string
    reason?: string
}

export interface DraftRecord {
    id: string
    course_code: string
    course_name: string
    section: string
    instructor_name: string
    day_of_week: number
    start_time: string
    end_time: string
    validation_status: string
    academic_head_review_status: string
    academic_head_review_notes: string | null
    has_internal_conflict: boolean
    has_external_conflict: boolean
    facilities: { name: string; room_number: string } | null
    departments: { id: string; code: string; name: string } | null
}

// ── Hook ───────────────────────────────────────────────

export function useScheduleHistory() {
    const [uploads, setUploads] = useState<UploadRecord[]>([])
    const [schedules, setSchedules] = useState<ScheduleRecord[]>([])
    const [modifications, setModifications] = useState<ModificationEntry[]>([])
    const [deletions, setDeletions] = useState<ScheduleRecord[]>([])
    const [drafts, setDrafts] = useState<DraftRecord[]>([])
    const [rolledBack, setRolledBack] = useState<ScheduleRecord[]>([])
    const [loading, setLoading] = useState({ uploads: true, schedules: true, changelog: true, drafts: true, rolledBack: true })
    const [error, setError] = useState<string | null>(null)

    // ── Fetch uploads ──
    const fetchUploads = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, uploads: true }))
            const res = await fetch('/api/schedules/history')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setUploads(data.uploads ?? [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(prev => ({ ...prev, uploads: false }))
        }
    }, [])

    // ── Fetch published schedules ──
    const fetchSchedules = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, schedules: true }))
            const res = await fetch('/api/schedules/history/published')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSchedules(data.schedules ?? [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(prev => ({ ...prev, schedules: false }))
        }
    }, [])

    // ── Fetch changelog ──
    const fetchChangelog = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, changelog: true }))
            const res = await fetch('/api/schedules/changelog')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setModifications(data.modifications ?? [])
            setDeletions(data.deletions ?? [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(prev => ({ ...prev, changelog: false }))
        }
    }, [])

    // ── Fetch drafts ──
    const fetchDrafts = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, drafts: true }))
            const res = await fetch('/api/schedules/history/drafts')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setDrafts(data.drafts ?? [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(prev => ({ ...prev, drafts: false }))
        }
    }, [])

    // ── Fetch rolled-back schedules ──
    const fetchRolledBack = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, rolledBack: true }))
            const res = await fetch('/api/schedules/history/rolled-back')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setRolledBack(data.rolledBack ?? [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(prev => ({ ...prev, rolledBack: false }))
        }
    }, [])

    // ── Initial load ──
    useEffect(() => {
        fetchUploads()
        fetchSchedules()
        fetchChangelog()
        fetchDrafts()
        fetchRolledBack()
    }, [fetchUploads, fetchSchedules, fetchChangelog, fetchDrafts, fetchRolledBack])

    // ── Rollback an upload ──
    const rollbackUpload = useCallback(async (uploadId: string) => {
        const res = await fetch(`/api/schedules/history/${uploadId}/rollback`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await Promise.all([fetchUploads(), fetchSchedules(), fetchChangelog(), fetchRolledBack()])
        return data
    }, [fetchUploads, fetchSchedules, fetchChangelog, fetchRolledBack])

    // ── Delete upload ──
    const deleteUpload = useCallback(async (uploadId: string) => {
        const res = await fetch(`/api/schedules/uploads/${uploadId}`, {
            method: 'DELETE'
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Failed to delete upload')
        await fetchUploads()
    }, [fetchUploads])

    // ── Edit schedule ──
    const editSchedule = useCallback(async (scheduleId: string, data: EditScheduleData) => {
        const res = await fetch(`/api/schedules/manage/${scheduleId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        await Promise.all([fetchSchedules(), fetchChangelog()])
        return result
    }, [fetchSchedules, fetchChangelog])

    // ── Delete schedule ──
    const deleteSchedule = useCallback(async (scheduleId: string) => {
        const res = await fetch(`/api/schedules/manage/${scheduleId}`, { method: 'DELETE' })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        await Promise.all([fetchSchedules(), fetchChangelog()])
        return result
    }, [fetchSchedules, fetchChangelog])

    // ── Global Rollback (soft-deletes active schedules, moves staging to Drafts) ──
    const rollbackSchedules = useCallback(async (scheduleIds: string[]) => {
        const res = await fetch(`/api/schedules/history/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleIds })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        await Promise.all([fetchSchedules(), fetchDrafts(), fetchRolledBack()])
        return result
    }, [fetchSchedules, fetchDrafts, fetchRolledBack])

    // ── Permanently delete rolled-back schedules ──
    const permanentDeleteSchedules = useCallback(async (scheduleIds: string[]) => {
        const res = await fetch('/api/schedules/history/rolled-back', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleIds })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        await fetchRolledBack()
        return result
    }, [fetchRolledBack])

    // ── Delete Drafts ──
    const deleteDrafts = useCallback(async (stagingIds: string[]) => {
        const res = await fetch(`/api/schedules/history/drafts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stagingIds })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        await fetchDrafts()
        return result
    }, [fetchDrafts])

    // ── Publish Drafts ──
    const publishDrafts = useCallback(async (stagingIds: string[]) => {
        const res = await fetch(`/api/schedules/history/drafts/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stagingIds })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        await Promise.all([fetchSchedules(), fetchDrafts()])
        return result
    }, [fetchSchedules, fetchDrafts])

    return {
        uploads,
        schedules,
        modifications,
        deletions,
        drafts,
        rolledBack,
        loading,
        error,
        rollbackUpload,
        deleteUpload,
        editSchedule,
        deleteSchedule,
        rollbackSchedules,
        permanentDeleteSchedules,
        deleteDrafts,
        publishDrafts,
        refetch: {
            uploads: fetchUploads,
            schedules: fetchSchedules,
            changelog: fetchChangelog,
            drafts: fetchDrafts,
            rolledBack: fetchRolledBack,
        },
    }
}
