import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { violationsClearedEmail } from '@/backend/notifications/emailTemplates'

const ROLE_MAP: Record<string, string> = {
  faculty: 'Faculty', program_head: 'Program Head', academic_head: 'Academic Head',
  building_admin: 'Building Admin', external_client: 'External Client', it_admin: 'IT Admin',
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireBuildingAdminStrict()
  if (error) return error

  const { id: targetUserId } = await params

  try {
    const supabase = createAdminClient()

    const { data: targetUser } = await supabase
      .from('users')
      .select('account_status, full_name, notification_email, user_roles!user_id(roles(name))')
      .eq('id', targetUserId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (targetUser.account_status !== 'active') {
      return NextResponse.json(
        { error: 'User must be active to clear violation history' },
        { status: 400 }
      )
    }

    // Remove violation logs so the scoring engine stops applying the -30 penalty
    await supabase
      .from('restriction_logs')
      .delete()
      .eq('user_id', targetUserId)
      .in('action', ['auto_restricted', 'manually_restricted'])

    // Record the clearance in the audit trail
    await supabase.from('restriction_logs').insert({
      user_id: targetUserId,
      action: 'restriction_lifted',
      actor_id: admin!.id,
      cancellation_count: 0,
      reason: 'Violation history cleared by Building Admin — scoring penalty removed',
    })

    await sendNotification(supabase, {
      user_id: targetUserId,
      title: 'Violation Record Cleared',
      message:
        'Your violation history has been cleared by the Building Admin. Your account is now in full standing and eligible for auto-approval without penalty.',
      type: 'success',
      source_type: 'user',
      source_id: targetUserId,
      priority: 'high',
    })

    void (async () => {
      const recipient = (targetUser as any)?.notification_email ?? null
      if (!recipient) return
      const rawRole = ((targetUser as any)?.user_roles as any)?.[0]?.roles?.name ?? ''
      await sendBrevoEmail({
        to: recipient,
        ...violationsClearedEmail({
          userName: targetUser.full_name ?? 'User',
          userRole: ROLE_MAP[rawRole] ?? undefined,
        }),
      }).catch(err => console.error('[clear-violations] email failed:', err))
    })()

    return NextResponse.json({
      success: true,
      message: `Violation history cleared for ${targetUser.full_name}.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
