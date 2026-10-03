import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { deleteUploadBatch } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head') && !roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const supabase = createAdminClient()
    const isAcademicHead = roles.includes('academic_head')
    await deleteUploadBatch(supabase, id, user.id, isAcademicHead)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.includes('Cannot delete') ? 409
      : message.includes('Forbidden') ? 403
      : message.includes('not found') ? 404
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
