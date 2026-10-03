/**
 * POST /api/schedules/review/[uploadId]/send-back
 * Academic Head: send the upload back for revision with notes.
 *
 * Body: { notes: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scheduleReturnedEmail } from '@/backend/notifications/emailTemplates'

const SendBackSchema = z.object({
  notes: z.string().min(10, 'Please provide revision notes (min 10 chars)'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { uploadId } = await params
  const body = await request.json()
  const parsed = SendBackSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select('upload_status, uploaded_by')
    .eq('id', uploadId)
    .single()

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  if (upload.upload_status !== 'submitted') {
    return NextResponse.json(
      { error: 'Only submitted uploads can be sent back' },
      { status: 409 }
    )
  }

  // Use the DB function to request revision
  const { error: rpcError } = await supabase.rpc('request_schedule_revision', {
    p_upload_id: uploadId,
    p_reviewer_id: user.id,
    p_notes: parsed.data.notes,
  })

  if (rpcError) {
    console.error('[POST /api/schedules/review/[uploadId]/send-back] Error:', rpcError.message)
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // Audit log
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'schedule_upload_returned',
      target_type: 'schedule_upload',
      target_id: uploadId,
      details: {
        revisionNotes: parsed.data.notes,
      },
    })
  } catch (auditErr) {
    console.error('[send-back] audit_logs insert failed:', auditErr)
  }

  // Notify the program head
  if (upload.uploaded_by) {
    await sendNotification(supabase, {
      user_id: upload.uploaded_by,
      title: 'Schedule Returned for Revision',
      message: `Your schedule upload has been returned for revision. Notes: ${parsed.data.notes}`,
      type: 'warning',
      source_type: 'schedule_upload',
      source_id: uploadId,
      priority: 'high',
      metadata: {
        upload_id: uploadId,
        revision_notes: parsed.data.notes,
        decided_by_name: user.full_name ?? user.email,
        decided_by_role: 'Academic Head',
      },
    })

    void (async () => {
      try {
        const { data: uploader } = await supabase
          .from('users')
          .select('full_name, email, notification_email')
          .eq('id', upload.uploaded_by)
          .single()
        if (uploader) {
          const to = (uploader as any).notification_email ?? null
          if (!to) {
            console.warn(`[send-back] Uploader ${upload.uploaded_by} has no notification_email set — returned email skipped`)
          } else {
            const { subject, htmlBody } = scheduleReturnedEmail({
              userName: (uploader as any).full_name ?? 'Submitter',
              revisionNotes: parsed.data.notes,
              reviewedByName: user.full_name ?? user.email ?? 'Academic Head',
            })
            await sendBrevoEmail({ to, subject, htmlBody })
          }
        }
      } catch {}
    })()
  }

  return NextResponse.json({ success: true })
}
