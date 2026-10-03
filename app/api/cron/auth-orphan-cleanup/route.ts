import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const orphans = data.users.filter(
    u => !u.email_confirmed_at && u.created_at < cutoff
  )

  let deleted = 0
  for (const u of orphans) {
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
    if (!delErr) {
      // public.users.id matches auth.users.id only for signup-trigger rows.
      // User-Manager-created profiles use unrelated UUIDs, so this won't touch them.
      await admin.from('users').delete().eq('id', u.id)
      deleted++
    } else {
      console.error('[auth-orphan-cleanup] delete failed:', u.id, delErr.message)
    }
  }

  const result = {
    scanned: data.users.length,
    candidates: orphans.length,
    deleted,
    cutoff,
  }

  console.log('[auth-orphan-cleanup]', result)
  return NextResponse.json(result)
}
