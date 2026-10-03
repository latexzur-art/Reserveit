import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { resetUserScore } from '@/backend/users/reliability.service'

const ALLOWED_REVIEWER_ROLES = ['academic_head', 'building_admin', 'admin', 'it_administrator']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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

  const { userId } = await params

  let body: { notes?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const supabase = createAdminClient()

  try {
    const result = await resetUserScore(supabase, userId, {
      actorId: user!.id,
      actorName: (user!.full_name as string) ?? 'Academic Head',
      source: 'manual',
      notes: body.notes?.trim() || undefined,
      forceReset: true,
    })
    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reset failed'
    console.error('[api/academic-head/reliability/reset] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
