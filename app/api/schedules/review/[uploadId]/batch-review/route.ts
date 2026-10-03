/**
 * POST /api/schedules/review/[uploadId]/batch-review
 * Academic Head: approve, flag, or reject individual entries.
 *
 * Body: {
 *   actions: Array<{
 *     entry_id: string
 *     action: 'academic_head_approved' | 'academic_head_flagged' | 'academic_head_rejected'
 *     notes?: string
 *   }>
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'

const BatchReviewSchema = z.object({
  actions: z.array(
    z.object({
      entry_id: z.string().uuid(),
      action: z.enum(['academic_head_approved', 'academic_head_flagged', 'academic_head_rejected']),
      notes: z.string().optional(),
    })
  ).min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { uploadId } = await params
  const body = await request.json()
  const parsed = BatchReviewSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify upload is in reviewable state
  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select('upload_status, uploaded_by')
    .eq('id', uploadId)
    .single()

  if (!upload || !['pending_submission', 'submitted', 'revision_requested', 'draft'].includes(upload.upload_status)) {
    return NextResponse.json(
      { error: 'Upload is not in a reviewable state' },
      { status: 409 }
    )
  }

  let successCount = 0
  const errors: string[] = []

  for (const { entry_id, action, notes } of parsed.data.actions) {
    const { error: updateError } = await supabase
      .from('schedule_entries_staging')
      .update({
        academic_head_review_status: action,
        academic_head_review_notes: notes ?? null,
        academic_head_reviewed_by: user.id,
        academic_head_reviewed_at: new Date().toISOString(),
      })
      .eq('id', entry_id)
      .eq('schedule_upload_id', uploadId)

    if (updateError) {
      errors.push(`Entry ${entry_id}: ${updateError.message}`)
    } else {
      successCount++
    }
  }

  // Notify the program head about review results
  if (upload.uploaded_by && successCount > 0) {
    const counts: Record<string, number> = {}
    for (const { action } of parsed.data.actions) {
      counts[action] = (counts[action] ?? 0) + 1
    }

    if (counts.academic_head_flagged) {
      await sendNotification(supabase, {
        user_id: upload.uploaded_by,
        title: 'Schedule Entries Flagged',
        message: `${counts.academic_head_flagged} ${counts.academic_head_flagged === 1 ? 'entry' : 'entries'} flagged by the Academic Head for revision. Review notes and make corrections.`,
        type: 'warning',
        source_type: 'schedule_upload',
        source_id: uploadId,
        priority: 'high',
      })
    }

    if (counts.academic_head_rejected) {
      await sendNotification(supabase, {
        user_id: upload.uploaded_by,
        title: 'Schedule Entries Rejected',
        message: `${counts.academic_head_rejected} ${counts.academic_head_rejected === 1 ? 'entry has' : 'entries have'} been rejected by the Academic Head. Review the notes.`,
        type: 'error',
        source_type: 'schedule_upload',
        source_id: uploadId,
        priority: 'high',
      })
    }

    if (counts.academic_head_approved) {
      await sendNotification(supabase, {
        user_id: upload.uploaded_by,
        title: 'Schedule Entries Approved',
        message: `${counts.academic_head_approved} ${counts.academic_head_approved === 1 ? 'entry' : 'entries'} approved by the Academic Head.`,
        type: 'success',
        source_type: 'schedule_upload',
        source_id: uploadId,
      })
    }
  }

  return NextResponse.json({
    success: true,
    updated: successCount,
    errors,
  })
}
