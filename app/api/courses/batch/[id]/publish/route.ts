import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { selfApproveBatch } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * Academic-head publish action for a draft / pending_submission / validation_failed
 * batch they own. Instant-approves the pending rows, no review queue involvement.
 * Program heads must use POST /api/courses/batch/[id]/submit instead.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('academic_head')) {
    return NextResponse.json(
      { error: 'Only academic heads can publish batches. Program heads should use /submit.' },
      { status: 403 }
    )
  }

  const { id } = await params

  try {
    const supabase = createAdminClient()
    await selfApproveBatch(supabase, id, user.id)
    return NextResponse.json({ success: true, message: 'Batch published' })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
