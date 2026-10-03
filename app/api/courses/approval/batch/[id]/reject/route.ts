import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { rejectBatchRows, rejectBatch } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const RejectSchema = z.object({
  reason: z.string().min(1),
  course_ids: z.array(z.string().uuid()).optional(),
  reject_all: z.boolean().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden: Academic Head only' }, { status: 403 })
  }

  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    if (parsed.data.reject_all) {
      await rejectBatch(supabase, id, parsed.data.reason, user.id)
      return NextResponse.json({ success: true, message: 'Entire batch rejected' })
    }

    if (parsed.data.course_ids?.length) {
      const result = await rejectBatchRows(supabase, id, parsed.data.course_ids, parsed.data.reason, user.id)
      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ error: 'Either course_ids or reject_all must be provided' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
