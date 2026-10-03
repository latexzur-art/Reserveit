import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
function requireAcademicHead(user: { roles?: { name: string }[] }) {
  const hasRole = user.roles?.some(r => ['academic_head', 'building_admin'].includes(r.name))
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
  }
  return null
}

const UpdateExceptionSchema = z.object({
  allowed_purpose_categories: z.array(z.string()).min(1).optional(),
  auto_approve_eligible: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const roleError = requireAcademicHead(user)
  if (roleError) return roleError

  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateExceptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.allowed_purpose_categories !== undefined) {
      updateData.allowed_purpose_categories = parsed.data.allowed_purpose_categories
    }
    if (parsed.data.auto_approve_eligible !== undefined) {
      updateData.auto_approve_eligible = parsed.data.auto_approve_eligible
    }
    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes
    }

    const { data, error: dbError } = await supabase
      .from('department_facility_exceptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({ exception: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const roleError = requireAcademicHead(user)
  if (roleError) return roleError

  const { id } = await params
  const supabase = createAdminClient()

  try {
    const { error: dbError } = await supabase
      .from('department_facility_exceptions')
      .delete()
      .eq('id', id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
