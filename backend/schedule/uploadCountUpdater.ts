/**
 * Upload Count Updater
 * Recalculates validation/conflict summary counts for a schedule upload.
 * @module backend/schedule/uploadCountUpdater
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface UploadCounts {
    total_entries: number
    valid_entries_count: number
    warning_entries_count: number
    error_entries_count: number
    conflict_count: number
}

/**
 * Recalculate all summary counts for a given upload by querying its staging entries.
 */
export async function recalculateUploadCounts(
    supabase: SupabaseClient,
    uploadId: string
): Promise<UploadCounts> {
    const { data: entries } = await supabase
        .from('schedule_entries_staging')
        .select('validation_status, has_internal_conflict, has_external_conflict')
        .eq('schedule_upload_id', uploadId)

    const rows = entries ?? []

    return {
        total_entries: rows.length,
        valid_entries_count: rows.filter(e => e.validation_status === 'valid').length,
        warning_entries_count: rows.filter(e => e.validation_status === 'warning').length,
        error_entries_count: rows.filter(e => e.validation_status === 'error').length,
        conflict_count: rows.filter(e => e.has_internal_conflict || e.has_external_conflict).length,
    }
}

/**
 * Recalculate and persist upload counts to the schedule_uploads table.
 */
export async function updateUploadCounts(
    supabase: SupabaseClient,
    uploadId: string
): Promise<UploadCounts> {
    const counts = await recalculateUploadCounts(supabase, uploadId)

    await supabase
        .from('schedule_uploads')
        .update(counts)
        .eq('id', uploadId)

    return counts
}
