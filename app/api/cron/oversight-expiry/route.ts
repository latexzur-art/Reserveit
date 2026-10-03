/**
 * GET /api/cron/oversight-expiry
 *
 * Cron job that runs periodically to handle expired oversight windows.
 * When an auto_approved booking's oversight_expires_at has passed without
 * an admin override, this route transitions it to 'approved' (fully committed)
 * and notifies admins.
 *
 * Secure via CRON_SECRET header to prevent unauthorized invocation.
 * Scheduled by .github/workflows/cron.yml (Vercel Hobby plan does not allow sub-daily crons).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getManilaNow } from '@/lib/timezone'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = getManilaNow().toISOString()

  // Find auto_approved bookings whose oversight window has expired
  const { data: expiredBookings, error } = await supabase
    .from('bookings')
    .select('id, booking_reference, user_id')
    .eq('current_status', 'auto_approved')
    .lt('oversight_expires_at', now)
    .limit(100)

  if (error) {
    console.error('[cron/oversight-expiry] Query error:', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!expiredBookings || expiredBookings.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const ids = expiredBookings.map(b => b.id)

  // Transition to 'approved' (fully committed, no longer under oversight)
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      current_status: 'approved',
      updated_at: now,
    })
    .in('id', ids)

  if (updateError) {
    console.error('[cron/oversight-expiry] Update error:', updateError.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Notify admins of the batch
  if (expiredBookings.length > 0) {
    const refs = expiredBookings.map(b => b.booking_reference).filter(Boolean).join(', ')
    await sendNotificationToRoles(supabase, ['building_admin', 'academic_head', 'it_admin'], {
      title: 'Oversight Windows Expired',
      message: `${expiredBookings.length} booking(s) have passed the 48-hour oversight window without admin intervention and are now fully approved. Refs: ${refs || 'N/A'}`,
      type: 'info',
      priority: 'normal',
    })
  }

  console.log(`[cron/oversight-expiry] Processed ${expiredBookings.length} bookings`)
  return NextResponse.json({ processed: expiredBookings.length })
}
