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

const CreateExceptionSchema = z.object({
  department_id: z.string().uuid(),
  facility_type: z.string().min(1).max(50),
  allowed_purpose_categories: z.array(z.string()).min(1),
  auto_approve_eligible: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
})

export async function GET() {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const roleError = requireAcademicHead(user)
  if (roleError) return roleError

  const supabase = createAdminClient()

  try {
    const { data, error: dbError } = await supabase
      .from('department_facility_exceptions')
      .select(`
        id,
        facility_type,
        allowed_purpose_categories,
        auto_approve_eligible,
        notes,
        created_at,
        updated_at,
        departments(id, code, name)
      `)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    return NextResponse.json({ exceptions: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const roleError = requireAcademicHead(user)
  if (roleError) return roleError

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateExceptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    const { data, error: dbError } = await supabase
      .from('department_facility_exceptions')
      .insert({
        department_id: parsed.data.department_id,
        facility_type: parsed.data.facility_type,
        allowed_purpose_categories: parsed.data.allowed_purpose_categories,
        auto_approve_eligible: parsed.data.auto_approve_eligible,
        notes: parsed.data.notes ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({ exception: data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
