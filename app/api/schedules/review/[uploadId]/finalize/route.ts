/**
 * POST /api/schedules/review/[uploadId]/finalize
 * Academic Head: finalize review → promote all academic_head_approved entries to class_schedules.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { promoteApprovedEntries } from '@/backend/schedule/schedulePromoter'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { uploadId } = await params
  const supabase = createAdminClient()

  // Verify upload is submitted
  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select('upload_status, uploaded_by, total_entries, users!uploaded_by(full_name), departments!department_id(name), academic_term')
    .eq('id', uploadId)
    .single()

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  if (!['submitted', 'revision_requested'].includes(upload.upload_status)) {
    return NextResponse.json(
      { error: `Upload cannot be finalized in status: ${upload.upload_status}` },
      { status: 409 }
    )
  }

  // Mark all remaining pending_review entries as academic_head_approved if not explicitly flagged/rejected
  await supabase
    .from('schedule_entries_staging')
    .update({
      academic_head_review_status: 'academic_head_approved',
      academic_head_reviewed_by: user.id,
      academic_head_reviewed_at: new Date().toISOString(),
    })
    .eq('schedule_upload_id', uploadId)
    .eq('academic_head_review_status', 'pending_review')
    .in('validation_status', ['valid', 'warning'])

  // Record reviewer
  await supabase
    .from('schedule_uploads')
    .update({
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', uploadId)

  // Promote approved entries to class_schedules
  const result = await promoteApprovedEntries(supabase, uploadId)

  // Notify the program head
  if (upload.uploaded_by) {
    const uploaderName = (upload as any).users?.full_name ?? 'Submitter'
    const deptName = (upload as any).departments?.name ?? null
    const term = (upload as any).academic_term ?? null
    const decidedByRole = (user.roles ?? []).map((r: { name: string }) => r.name)[0] ?? 'academic_head'
    await sendNotification(supabase, {
      user_id: upload.uploaded_by,
      title: result.skipped_count > 0 ? 'Schedule Partially Published' : 'Schedule Approved and Published',
      message: `Your schedule upload has been approved by ${user.full_name}. ${result.promoted_count} entr${result.promoted_count === 1 ? 'y' : 'ies'} are now live.${result.skipped_count > 0 ? ` ${result.skipped_count} entr${result.skipped_count === 1 ? 'y was' : 'ies were'} skipped due to conflicts.` : ''}`,
      type: result.skipped_count > 0 ? 'warning' : 'success',
      source_type: 'schedule_upload',
      source_id: uploadId,
      priority: 'high',
      metadata: {
        upload_id: uploadId,
        entries_published: result.promoted_count,
        entries_skipped: result.skipped_count,
        total_entries: upload.total_entries,
        submitted_by: uploaderName,
        department: deptName,
        academic_term: term,
        decided_by_name: user.full_name,
        decided_by_role: decidedByRole,
        status_to: result.skipped_count > 0 ? 'partially_approved' : 'approved',
      },
    })
  }

  return NextResponse.json({
    success: true,
    promoted_count: result.promoted_count,
    skipped_count: result.skipped_count,
    errors: result.errors,
  })
}
