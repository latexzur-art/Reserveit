/**
 * Shared helpers for the course-approval modules.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Internal helper ──────────────────────────────────────────────────────────

export interface BatchMeta {
  uploadedBy: string
  submitterEmail: string
  submitterNotificationEmail: string | null
  submitterName: string
  departmentName: string
  termName: string
  totalEntries: number
  uploaderNotes: string | null
}

export async function loadBatchMeta(
  supabase: SupabaseClient,
  batchId: string
): Promise<BatchMeta | null> {
  const { data, error } = await supabase
    .from('course_uploads')
    .select(`
      uploaded_by,
      total_entries,
      uploader_notes,
      departments ( name ),
      academic_terms ( term_name ),
      users!course_uploads_uploaded_by_fkey ( full_name, email, notification_email )
    `)
    .eq('id', batchId)
    .single()

  if (error || !data) return null

  const dept = data.departments as any
  const term = data.academic_terms as any
  const uploader = data.users as any

  return {
    uploadedBy: data.uploaded_by,
    submitterEmail: uploader?.email ?? '',
    submitterNotificationEmail: uploader?.notification_email ?? null,
    submitterName: uploader?.full_name ?? 'Program Head',
    departmentName: dept?.name ?? 'Unknown Department',
    termName: term?.term_name ?? 'Unknown Term',
    totalEntries: data.total_entries ?? 0,
    uploaderNotes: data.uploader_notes ?? null,
  }
}

export async function getReviewerName(
  supabase: SupabaseClient,
  reviewerId: string
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', reviewerId)
    .single()
  return (data as any)?.full_name ?? 'Academic Head'
}

export function formatReviewedAt(isoString: string): string {
  return new Date(isoString).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// ── Public API ───────────────────────────────────────────────────────────────
