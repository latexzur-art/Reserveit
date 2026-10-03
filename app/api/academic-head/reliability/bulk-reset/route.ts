import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { resetUserScore } from '@/backend/users/reliability.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scoreResetBulkDigestEmail } from '@/backend/notifications/emailTemplates'

const ALLOWED_REVIEWER_ROLES = ['academic_head', 'building_admin', 'admin', 'it_administrator']
const TEACHING_ROLES = ['faculty', 'program_head', 'teacher', 'professor']

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const roles = ((user!.roles ?? []) as Array<{ name: string }>).map((r) => r.name.toLowerCase())
  if (!roles.some((r) => ALLOWED_REVIEWER_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Forbidden: academic head or admin role required' },
      { status: 403 }
    )
  }

  let body: {
    scope?: 'all' | 'department'
    departmentId?: string
    notes?: string
    confirm?: boolean
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
  }
  const scope = body.scope ?? 'all'
  if (scope === 'department' && !body.departmentId) {
    return NextResponse.json({ error: 'departmentId is required when scope=department' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('users')
    .select(`
      id,
      department_id,
      consecutive_cancellations,
      account_status,
      user_roles!user_roles_user_id_fkey(is_active, role:roles(name))
    `)
    .gt('consecutive_cancellations', 0)
  if (scope === 'department') query = query.eq('department_id', body.departmentId!)

  const { data: candidates, error: dbError } = await query
  if (dbError) {
    console.error('[api/academic-head/reliability/bulk-reset] query failed:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const targets = (candidates ?? []).filter((u: any) => {
    const rawUserRoles = Array.isArray(u.user_roles) ? u.user_roles : []
    const userRoleNames: string[] = rawUserRoles
      .filter((ur: any) => ur && ur.is_active !== false && ur.role && typeof ur.role.name === 'string')
      .map((ur: any) => ur.role.name.toLowerCase() as string)
    return userRoleNames.some((r) => TEACHING_ROLES.includes(r))
  })

  let affected = 0
  const results: Array<{ userId: string; changed: boolean }> = []
  for (const t of targets) {
    try {
      const result = await resetUserScore(supabase, t.id as string, {
        actorId: user!.id,
        actorName: (user!.full_name as string) ?? 'Academic Head',
        source: 'bulk',
        notes: body.notes?.trim() || undefined,
        skipEmail: true,
      })
      if (result.changed) affected++
      results.push({ userId: t.id as string, changed: result.changed })
    } catch (err) {
      console.error('[bulk-reset] reset failed for', t.id, err instanceof Error ? err.message : err)
    }
  }

  void (async () => {
    const { data: actor } = await supabase
      .from('users')
      .select('full_name, notification_email')
      .eq('id', user!.id)
      .single()
    const recipient = (actor?.notification_email as string | null) ?? null
    if (!recipient) return
    const scopeLabel =
      scope === 'all' ? 'All teaching staff' : `Department ${body.departmentId}`
    void sendBrevoEmail({
      to: recipient,
      ...scoreResetBulkDigestEmail({
        academicHeadName:
          (actor?.full_name as string) ?? (user!.full_name as string) ?? 'Academic Head',
        affectedCount: affected,
        scopeLabel,
        decidedAt: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        notes: body.notes?.trim() || undefined,
      }),
    }).catch((err) =>
      console.error('[bulk-reset] digest email failed:', err instanceof Error ? err.message : err)
    )
  })()

  return NextResponse.json({ success: true, affected, results })
}
