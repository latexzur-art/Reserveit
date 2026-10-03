import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
export async function GET(_request: NextRequest) {
  const { error } = await requireBuildingAdminStrict()
  if (error) return error

  try {
    const supabase = createAdminClient()

    const { data: users, error: queryError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        account_status,
        consecutive_cancellations,
        restricted_at,
        restricted_reason,
        appeal_reason,
        appeal_submitted_at,
        probation_started_at,
        probation_lifted_at
      `)
      .in('account_status', ['restricted', 'probation'])
      .order('restricted_at', { ascending: false })

    if (queryError) throw queryError

    // Fetch latest restriction log for each user
    const userIds = (users ?? []).map((u: { id: string }) => u.id)
    let restrictionLogs: Record<string, unknown>[] = []

    if (userIds.length > 0) {
      const { data: logs } = await supabase
        .from('restriction_logs')
        .select('user_id, action, reason, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })

      const logMap = new Map<string, Record<string, unknown>>()
      for (const log of (logs ?? []) as Array<Record<string, string>>) {
        if (!logMap.has(log.user_id)) {
          logMap.set(log.user_id, log)
        }
      }
      restrictionLogs = [...logMap.values()]
    }

    return NextResponse.json({
      users: users ?? [],
      restriction_logs: restrictionLogs,
      total: (users ?? []).length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
