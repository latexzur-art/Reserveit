import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { clearUploadHistory } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supabase = createAdminClient()
    const { cleared } = await clearUploadHistory(supabase, user.id)
    return NextResponse.json({ cleared })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
