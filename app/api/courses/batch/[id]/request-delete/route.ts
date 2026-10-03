import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { NotificationService } from '@/backend/notifications/notification.service'
import { getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { curriculumDeletionRequestedEmail } from '@/backend/notifications/emailTemplates'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * POST /api/courses/batch/[id]/request-delete
 * Program Head requests deletion of a batch → notifies Academic Head
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head')) {
    return NextResponse.json({ error: 'Forbidden: Program Head only' }, { status: 403 })
  }

  const { id: batchId } = await params

  let reason = ''
  try {
    const body = await request.json()
    reason = body.reason?.trim() ?? ''
  } catch {}

  try {
    const supabase = createAdminClient()

    // Get batch info
    const { data: batch, error: batchErr } = await supabase
      .from('course_uploads')
      .select(`
        id, upload_status, uploaded_by, total_entries,
        departments(name),
        users!course_uploads_uploaded_by_fkey(full_name)
      `)
      .eq('id', batchId)
      .single()

    if (batchErr || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Only the uploader or a program head can request deletion
    if (batch.uploaded_by !== user.id) {
      return NextResponse.json({ error: 'You can only request deletion of your own uploads' }, { status: 403 })
    }

    // Mark the batch with a deletion request via review_notes
    const marker = `[DELETE_REQUESTED] ${reason || 'No reason provided'}`
    await supabase
      .from('course_uploads')
      .update({
        review_notes: marker,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    // Notify all Academic Heads
    const dept = batch.departments as any
    const uploader = batch.users as any
    const uploaderName = uploader?.full_name ?? 'A Program Head'
    const deptName = dept?.name ?? 'Unknown Department'

    try {
      await NotificationService.createForRoles(['academic_head'], {
        title: 'Batch Deletion Requested',
        message: `${uploaderName} has requested deletion of their ${deptName} curriculum batch (${batch.total_entries} courses).${reason ? ` Reason: ${reason}` : ''}`,
        type: 'warning',
        source_type: 'course_upload',
        source_id: batchId,
        priority: 'high',
        action_url: '/academic/curriculum/upload-history',
      })

      const academicHeadEmail = await getAcademicHeadEmail()
      if (academicHeadEmail) {
        const { subject, htmlBody } = curriculumDeletionRequestedEmail({
          requesterName: uploaderName,
          departmentName: deptName,
          totalEntries: batch.total_entries ?? 0,
          reason,
          reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/academic/curriculum/upload-history`,
        })
        await sendBrevoEmail({ to: academicHeadEmail, subject, htmlBody })
      } else {
        console.warn('[request-delete] Email skipped — no active Academic Head found')
      }
    } catch (notifErr) {
      console.error('[request-delete] Notification failed:', notifErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
