import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'

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
      .select('account_status, full_name')
      .eq('id', targetUserId)
      .single()

    if (!targetUser || targetUser.account_status !== 'probation') {
      return NextResponse.json({ error: 'User is not on probation' }, { status: 400 })
    }

    const now = new Date().toISOString()

    await supabase
      .from('users')
      .update({
        account_status: 'active',
        consecutive_cancellations: 0,
        probation_lifted_at: now,
        probation_lifted_by: admin!.id,
        updated_at: now,
      })
      .eq('id', targetUserId)

    await supabase.from('restriction_logs').insert({
      user_id: targetUserId,
      action: 'probation_ended',
      actor_id: admin!.id,
      cancellation_count: 0,
      reason: 'Probation ended by Building Admin — full auto-approval restored',
    })

    await sendNotification(supabase, {
      user_id: targetUserId,
      title: 'Probation Ended — Full Access Restored',
      message:
        'Your probation period has ended. Your account is now fully active and eligible for auto-approval.',
      type: 'success',
      source_type: 'user',
      source_id: targetUserId,
      priority: 'high',
    })

    return NextResponse.json({
      success: true,
      message: `Probation ended. ${targetUser.full_name} is now fully active.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
