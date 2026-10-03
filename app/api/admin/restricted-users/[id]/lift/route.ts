import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUserManager } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireUserManager()
  if (error) return error

  const { id: targetUserId } = await params

  try {
    const supabase = createAdminClient()

    // Verify user is restricted
    const { data: targetUser } = await supabase
      .from('users')
      .select('account_status, full_name, consecutive_cancellations')
      .eq('id', targetUserId)
      .single()

    if (!targetUser || targetUser.account_status !== 'restricted') {
      return NextResponse.json({ error: 'User is not restricted' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Move to probation
    await supabase
      .from('users')
      .update({
        account_status: 'probation',
        restriction_lifted_by: admin.id,
        restriction_lifted_at: now,
        probation_started_at: now,
        updated_at: now,
      })
      .eq('id', targetUserId)

    // Log the restriction lift
    await supabase.from('restriction_logs').insert({
      user_id: targetUserId,
      action: 'probation_started',
      actor_id: admin.id,
      cancellation_count: targetUser.consecutive_cancellations,
      reason: 'Restriction lifted by administrator — account moved to probation',
    })

    // Notify user
    await sendNotification(supabase, {
      user_id: targetUserId,
      title: 'Account Restriction Lifted — Probation Period',
      message:
        'Your account restriction has been lifted. You are now in a probation period — all bookings will require manual admin approval until probation ends.',
      type: 'info',
      source_type: 'user',
      source_id: targetUserId,
      priority: 'high',
    })

    return NextResponse.json({
      success: true,
      message: `Restriction lifted. ${targetUser.full_name} is now on probation.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /admin/restricted-users/[id]/lift error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
