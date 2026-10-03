/**
 * Conflict Notifier
 * Notifies affected Program Heads when cross-department schedule conflicts are detected.
 * @module backend/schedule/conflictNotifier
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'

/**
 * Notify program heads of cross-department conflicts discovered in an upload.
 */
export async function notifyCrossDeptConflicts(
  supabase: SupabaseClient,
  uploadId: string
): Promise<void> {
  // Get the uploading department info
  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select(`
      id,
      department_id,
      uploaded_by,
      departments!inner(name)
    `)
    .eq('id', uploadId)
    .single()

  if (!upload) return

  const uploadDepts = (upload as any).departments
  const deptRaw = Array.isArray(uploadDepts) ? uploadDepts[0] : uploadDepts
  const deptName = deptRaw?.name ?? 'Unknown Department'

  // Find entries in this upload that have cross-department conflicts (external flag)
  const { data: conflictEntries } = await supabase
    .from('schedule_entries_staging')
    .select('id, conflict_entry_ids')
    .eq('schedule_upload_id', uploadId)
    .eq('has_external_conflict', true)

  if (!conflictEntries || conflictEntries.length === 0) return

  // Collect the other entry IDs from cross-dept conflicts
  const otherEntryIds = new Set<string>()
  for (const entry of conflictEntries) {
    for (const id of (entry.conflict_entry_ids ?? []) as string[]) {
      otherEntryIds.add(id)
    }
  }

  if (otherEntryIds.size === 0) return

  // Find which uploads those entries belong to
  const { data: otherEntries } = await supabase
    .from('schedule_entries_staging')
    .select('schedule_upload_id')
    .in('id', [...otherEntryIds])

  if (!otherEntries || otherEntries.length === 0) return

  const otherUploadIds = [...new Set(otherEntries.map((e) => e.schedule_upload_id))]

  // Get uploaders of those other uploads
  const { data: otherUploads } = await supabase
    .from('schedule_uploads')
    .select('uploaded_by, departments!inner(name)')
    .in('id', otherUploadIds)

  for (const other of otherUploads ?? []) {
    if (!other.uploaded_by) continue

    await sendNotification(supabase, {
      user_id: other.uploaded_by,
      title: 'Schedule Conflict Detected',
      message: `A schedule upload from ${deptName} has overlapping room assignments with your department's schedule. Please coordinate to resolve.`,
      type: 'warning',
      source_type: 'schedule_conflict',
      source_id: uploadId,
    })
  }

  // Also notify the uploader of this upload about what conflicts they caused
  if (upload.uploaded_by) {
    await sendNotification(supabase, {
      user_id: upload.uploaded_by,
      title: 'Cross-Department Schedule Conflicts Found',
      message: `Your schedule upload has room conflicts with other departments. Review and resolve before submitting for Academic Head approval.`,
      type: 'warning',
      source_type: 'schedule_conflict',
      source_id: uploadId,
    })
  }
}
