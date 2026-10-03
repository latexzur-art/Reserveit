import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { resetUserScore } from '@/backend/users/reliability.service'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scoreResetDeclinedEmail } from '@/backend/notifications/emailTemplates'

const ALLOWED_REVIEWER_ROLES = ['academic_head', 'building_admin', 'admin', 'it_administrator']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const roles = ((user!.roles ?? []) as Array<{ name: string }>).map((r) => r.name.toLowerCase())
  if (!roles.some((r) => ALLOWED_REVIEWER_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Forbidden: academic head or admin role required' },
      { status: 403 }
    )
  }

  const { requestId } = await params

  let body: { decision?: 'approve' | 'decline'; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (body.decision !== 'approve' && body.decision !== 'decline') {
    return NextResponse.json({ error: 'decision must be approve or decline' }, { status: 400 })
  }
  const notes = body.notes?.trim() || undefined

  const supabase = createAdminClient()

  const { data: row, error: fetchError } = await supabase
    .from('score_reset_requests')
    .select('id, user_id, status, reason, reset_type')
    .eq('id', requestId)
    .single()
  if (fetchError || !row) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${row.status}` }, { status: 409 })
  }

  const now = new Date().toISOString()
  const newStatus = body.decision === 'approve' ? 'approved' : 'declined'

  const { error: updateError } = await supabase
    .from('score_reset_requests')
    .update({
      status: newStatus,
      reviewed_by: user!.id,
      reviewed_at: now,
      review_notes: notes ?? null,
      updated_at: now,
    })
    .eq('id', requestId)
  if (updateError) {
    console.error('[reliability/requests/decision] update failed:', updateError.message)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (body.decision === 'approve') {
    try {
      await resetUserScore(supabase, row.user_id as string, {
        actorId: user!.id,
        actorName: (user!.full_name as string) ?? 'Academic Head',
        source: 'request',
        notes,
        forceReset: (row.reset_type as string) === 'cancellation_rate',
      })
    } catch (err) {
      console.error('[reliability/requests/decision] reset failed:', err instanceof Error ? err.message : err)
    }
  } else {
    await sendNotification(supabase, {
      user_id: row.user_id as string,
      title: 'Reset Request Declined',
      message: notes
        ? `Your reset request was declined. Notes: ${notes}`
        : 'Your reset request was declined.',
      type: 'warning',
      source_type: 'score_reset_request',
      source_id: row.id as string,
      priority: 'normal',
    })

    void (async () => {
      const { data: target } = await supabase
        .from('users')
        .select('full_name, notification_email')
        .eq('id', row.user_id as string)
        .single()
      const recipient = (target?.notification_email as string | null) ?? null
      if (!recipient) return
      void sendBrevoEmail({
        to: recipient,
        ...scoreResetDeclinedEmail({
          userName: (target?.full_name as string) ?? 'User',
          decidedBy: (user!.full_name as string) ?? 'Academic Head',
          notes,
        }),
      }).catch((err) =>
        console.error('[reliability/requests/decision] decline email failed:', err instanceof Error ? err.message : err)
      )
    })()
  }

  return NextResponse.json({ success: true, status: newStatus })
}
