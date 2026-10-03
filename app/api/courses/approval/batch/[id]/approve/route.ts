import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { approveBatch } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden: Academic Head only' }, { status: 403 })
  }

  const { id } = await params

  try {
    const supabase = createAdminClient()
    const result = await approveBatch(supabase, id, user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
