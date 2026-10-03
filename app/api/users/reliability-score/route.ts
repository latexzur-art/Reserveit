import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { RESTRICTION_THRESHOLD } from '@/backend/booking/booking.types'

export async function GET() {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const supabase = createAdminClient()

  const { data: row, error: dbError } = await supabase
    .from('users')
    .select('user_type, consecutive_cancellations, account_status')
    .eq('id', user!.id)
    .single()

  if (dbError || !row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const userType = (row.user_type as string | null) ?? 'internal'
  const count = (row.consecutive_cancellations as number | null) ?? 0
  const accountStatus = (row.account_status as string | null) ?? 'active'

  // Check BA policy setting for external client cancellation enforcement
  const { data: policySetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'enforce_external_client_cancellations')
    .maybeSingle()

  const enforceExternal = policySetting ? Boolean(policySetting.value) : false
  const isExempt = userType === 'external' && !enforceExternal

  const { data: pending } = await supabase
    .from('score_reset_requests')
    .select('id, created_at')
    .eq('user_id', user!.id)
    .eq('status', 'pending')
    .maybeSingle()

  const status: 'good' | 'warning' | 'restricted' =
    accountStatus === 'restricted'
      ? 'restricted'
      : count >= RESTRICTION_THRESHOLD - 1
        ? 'warning'
        : 'good'

  return NextResponse.json({
    count: isExempt ? 0 : count,
    threshold: RESTRICTION_THRESHOLD,
    status: isExempt ? 'good' : status,
    accountStatus,
    isExempt,
    exemptionReason: isExempt ? 'External client accounts are exempt from cancellation restriction tracking.' : null,
    pendingRequest: pending
      ? { id: pending.id as string, createdAt: pending.created_at as string }
      : null,
  })
}
