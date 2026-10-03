import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { getCoursesByDepartment, createCourse, validateCourse } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const CreateCourseSchema = z.object({
  department_code: z.string().min(1),
  course_code: z.string().min(4).max(20),
  course_name: z.string().min(1),
  units: z.number().int().positive(),
  year_level: z.number().int().min(1).max(4),
  term: z.number().int().min(1).max(2),
  delivery_mode: z.enum(['lecture', 'lab', 'both', 'practicum']),
  lecture_hours: z.number().nullable().optional(),
  lab_hours: z.number().nullable().optional(),
  prerequisite_codes: z.array(z.string()).optional(),
  is_elective: z.boolean().optional(),
  elective_type: z.string().trim().max(255).optional(),
  description: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const roles = (user.roles ?? []).map((r: any) => r.name)

  try {
    const supabase = createAdminClient()
    const filters: Record<string, any> = {
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '25'),
      search: searchParams.get('search') || undefined,
      year_level: searchParams.get('year_level') ? parseInt(searchParams.get('year_level')!) : undefined,
      term: searchParams.get('term') ? parseInt(searchParams.get('term')!) : undefined,
      delivery_mode: searchParams.get('delivery_mode') || undefined,
      approval_status: searchParams.get('approval_status') || undefined,
      batch_upload_id: searchParams.get('batch_upload_id') || undefined,
    }

    // Program heads see only their department, unless fetching by batch (batch ownership is implicit)
    if (roles.includes('program_head') && !roles.includes('academic_head') && !filters.batch_upload_id) {
      filters.department_code = user.department?.code
    } else {
      filters.department_code = searchParams.get('department_code') || undefined
    }

    const result = await getCoursesByDepartment(supabase, filters)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head') && !roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const validation = await validateCourse(supabase, parsed.data)
    if (!validation.valid) {
      return NextResponse.json({ error: 'Course validation failed', validation }, { status: 400 })
    }

    const isAcademicHead = roles.includes('academic_head')
    const course = await createCourse(supabase, parsed.data, user.id, isAcademicHead)
    return NextResponse.json({ course, warnings: validation.warnings }, { status: 201 })
  } catch (err) {
    const msg = getErrorMessage(err)
    const status = msg.includes('already exists') ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
