/**
 * POST /api/schedules/uploads/[id]/submit
 * Program Head submits an upload for Academic Head review.
 * Fails if there are any error-status entries.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scheduleSubmittedEmail } from '@/backend/notifications/emailTemplates'
import { parseUuidParam } from '@/lib/api/validate-uuid'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const { id: rawId } = await params
  const idParse = parseUuidParam(rawId, 'upload id')
  if (!idParse.ok) return idParse.response
  const uploadId = idParse.value
  const supabase = createAdminClient()

  // Verify ownership
  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select('uploaded_by, upload_status, error_entries_count, total_entries, department_id')
    .eq('id', uploadId)
    .single()

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }
  if (upload.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const submittableStatuses = ['draft', 'validation_failed', 'pending_submission', 'revision_requested']
  if (!submittableStatuses.includes(upload.upload_status)) {
    return NextResponse.json(
      { error: `Upload cannot be submitted in status: ${upload.upload_status}` },
      { status: 409 }
    )
  }

  // Count actual errors from staging entries — the aggregate column is stale after edits
  const { count: actualErrorCount } = await supabase
    .from('schedule_entries_staging')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_upload_id', uploadId)
    .eq('validation_status', 'error')

  if ((actualErrorCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot submit: ${actualErrorCount} entries still have errors. Fix them first.` },
      { status: 422 }
    )
  }

  // Sync the stale aggregate counts before submitting
  const { count: warnCount } = await supabase
    .from('schedule_entries_staging')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_upload_id', uploadId)
    .eq('validation_status', 'warning')

  const { count: validCount } = await supabase
    .from('schedule_entries_staging')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_upload_id', uploadId)
    .eq('validation_status', 'valid')

  // Update status directly — bypass RPC which reads the stale error_entries_count column
  const { error: submitError } = await supabase
    .from('schedule_uploads')
    .update({
      upload_status: 'submitted',
      submitted_at: new Date().toISOString(),
      error_entries_count: 0,
      warning_entries_count: warnCount ?? 0,
      valid_entries_count: validCount ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', uploadId)
    .in('upload_status', ['draft', 'pending_submission', 'revision_requested', 'validation_failed'])

  if (submitError) {
    console.error('[POST /api/schedules/uploads/[id]/submit] Error:', submitError.message)
    return NextResponse.json({ error: submitError.message }, { status: 500 })
  }

  // Audit log
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'schedule_upload_submitted',
      target_type: 'schedule_upload',
      target_id: uploadId,
      details: {
        totalEntries: upload.total_entries,
      },
    })
  } catch (auditErr) {
    console.error('[submit] audit_logs insert failed:', auditErr)
  }

  // Notify the submitter (program head)
  await sendNotification(supabase, {
    user_id: user.id,
    title: 'Schedule Submitted for Review',
    message: `Your schedule upload (${upload.total_entries} entries) has been submitted for Academic Head review. You will be notified once it is reviewed.`,
    type: 'info',
    source_type: 'schedule_upload',
    source_id: uploadId,
    priority: 'normal',
    metadata: {
      upload_id: uploadId,
      total_entries: upload.total_entries,
      status_to: 'submitted',
    },
  })

  // Notify academic heads about the new submission (with rich metadata)
  const { data: deptData } = await supabase
    .from('users')
    .select('full_name, departments!department_id(name)')
    .eq('id', user.id)
    .single()
  const deptRaw = (deptData as any)?.departments
  const deptName = deptRaw ? (Array.isArray(deptRaw) ? deptRaw[0]?.name : deptRaw?.name) : null

  const { data: academicHeads } = await supabase
    .from('user_roles')
    .select('user_id, roles!inner(name)')
    .eq('roles.name', 'academic_head' as any)

  const ahNamesAndEmails = []
  for (const ah of academicHeads ?? []) {
    const { data: ahUser } = await supabase
      .from('users')
      .select('full_name, email, notification_email')
      .eq('id', ah.user_id)
      .single()

    const ahName = ahUser?.full_name ?? 'Academic Head'
    
    await sendNotification(supabase, {
      user_id: ah.user_id,
      title: 'New Schedule Upload Awaiting Review',
      message: `${(deptData as any)?.full_name ?? 'A program head'}${deptName ? ` (${deptName})` : ''} submitted a class schedule with ${upload.total_entries} entries for your review.`,
      type: 'info',
      source_type: 'schedule_upload',
      source_id: uploadId,
      priority: 'normal',
      action_url: '/academic/schedules/review',
      metadata: {
        upload_id: uploadId,
        total_entries: upload.total_entries,
        submitted_by: (deptData as any)?.full_name ?? 'Unknown',
        department: deptName ?? 'Unknown Department',
      },
    })

    if (ahUser) {
      const to = (ahUser as any).notification_email ?? null
      if (to) {
        ahNamesAndEmails.push({ to, ahName })
      }
    }
  }

  // Send emails to Academic Heads in the background
  if (ahNamesAndEmails.length > 0) {
    void (async () => {
      try {
        for (const { to, ahName } of ahNamesAndEmails) {
          const { subject, htmlBody } = scheduleSubmittedEmail({
            ahName,
            submitterName: (deptData as any)?.full_name ?? 'A Program Head',
            departmentName: deptName ?? 'a department',
            totalEntries: upload.total_entries,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/academic/schedules/review`,
          })
          await sendBrevoEmail({ to, subject, htmlBody })
        }
      } catch (e) {
        console.error('[POST /api/schedules/uploads/[id]/submit] Email error:', e)
      }
    })()
  }

  return NextResponse.json({ success: true })
}
