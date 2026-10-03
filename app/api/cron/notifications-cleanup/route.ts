/**
 * GET /api/cron/notifications-cleanup
 *
 * Cron job that runs daily to clean up:
 * 1. Expired notifications (where expires_at < now)
 * 2. Old read notifications (read = true and older than 30 days)
 *
 * Secure via CRON_SECRET header.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Delete expired notifications
  const { data: expired } = await supabase
    .from('notifications')
    .delete()
    .lt('expires_at', now)
    .not('expires_at', 'is', null)
    .select('id')

  // 2. Delete old read notifications (> 30 days)
  const { data: oldRead } = await supabase
    .from('notifications')
    .delete()
    .eq('read', true)
    .lt('created_at', thirtyDaysAgo)
    .select('id')

  const result = {
    expired_deleted: expired?.length ?? 0,
    old_read_deleted: oldRead?.length ?? 0,
    timestamp: now,
  }

  console.log('[notifications-cleanup]', result)

  return NextResponse.json(result)
}
