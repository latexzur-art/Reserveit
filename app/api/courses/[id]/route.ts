import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { updateCourse, validateCourse } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'


export const dynamic = 'force-dynamic'

const UpdateCourseSchema = z.object({
  course_name: z.string().min(1).optional(),
  units: z.number().int().positive().optional(),
  year_level: z.number().int().min(1).max(4).optional(),
  term: z.number().int().min(1).max(2).optional(),
  delivery_mode: z.enum(['lecture', 'lab', 'both', 'practicum']).optional(),
  lecture_hours: z.number().nullable().optional(),
  lab_hours: z.number().nullable().optional(),
  prerequisite_codes: z.array(z.string()).optional(),
  is_elective: z.boolean().optional(),
  elective_type: z.string().trim().max(255).optional(),
  is_active: z.boolean().optional(),
  description: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head') && !roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Only re-validate when the request actually touches the relevant fields, so editing
    // unrelated fields on a legacy/already-flagged course isn't retroactively blocked.
    if ('is_elective' in parsed.data || 'elective_type' in parsed.data || 'year_level' in parsed.data || 'term' in parsed.data) {
      const { data: existing } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()

      if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 400 })

      let labelYearLevel: number | null = null
      let labelTerm: number | null = null
      if (existing.batch_upload_id) {
        const { data: batch } = await supabase
          .from('course_uploads')
          .select('label_year_level, label_term')
          .eq('id', existing.batch_upload_id)
          .single()
        labelYearLevel = batch?.label_year_level ?? null
        labelTerm = batch?.label_term ?? null
      }

      const merged = { ...existing, ...parsed.data }
      const validation = await validateCourse(supabase, merged, { skipDuplicateCheck: true, labelYearLevel, labelTerm })
      if (!validation.valid) {
        return NextResponse.json({ error: 'Course validation failed', validation }, { status: 400 })
      }
    }

    const isAcademicHead = roles.includes('academic_head')
    const course = await updateCourse(supabase, id, parsed.data, user.id, isAcademicHead)
    return NextResponse.json({ course })
  } catch (err) {
    const msg = getErrorMessage(err)
    const status = msg.includes('Can only edit') || msg.includes('not found') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

// PATCH: Approve a pending course (academic head only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Only academic heads can approve courses' }, { status: 403 })
  }

  const { id } = await params
  let body: { action: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.action !== 'approve' && body.action !== 'override') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    if (body.action === 'override') {
      // Override: approve a course regardless of its current status (clears rejection_reason)
      const { data, error } = await supabase
        .from('courses')
        .update({ approval_status: 'approved', rejection_reason: null, approved_by: user.id, approved_at: now, updated_at: now })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      return NextResponse.json({ course: data })
    }

    // Default: approve — only works for pending courses
    const { data, error } = await supabase
      .from('courses')
      .update({ approval_status: 'approved', approved_by: user.id, approved_at: now, updated_at: now })
      .eq('id', id)
      .eq('approval_status', 'pending')
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Course not found or not pending' }, { status: 404 })
    return NextResponse.json({ course: data })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

// DELETE: Remove a course (academic head or program head)
export async function DELETE(
  request: NextRequest,
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

    // Check if course exists
    const { data: course, error: fetchErr } = await supabase
      .from('courses')
      .select('id, course_code, course_name')
      .eq('id', id)
      .single()

    if (fetchErr || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const force = request.nextUrl.searchParams.get('force') === 'true'

    // Check for active schedules referencing this course's code
    const { count: scheduleCount } = await supabase
      .from('class_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('course_code', course.course_code)

    if (scheduleCount && scheduleCount > 0) {
      const isAcademicHead = roles.includes('academic_head')
      
      if (!force) {
        return NextResponse.json(
          { 
            error: `Cannot delete course "${course.course_code}" because it has ${scheduleCount} schedule(s) linked to it. ${!isAcademicHead ? 'Please ask an Academic Head to remove it.' : ''}`, 
            requiresForce: isAcademicHead 
          },
          { status: 409 }
        )
      } else if (!isAcademicHead) {
        return NextResponse.json(
          { error: 'Only Academic Heads can force delete courses with active schedules.' },
          { status: 403 }
        )
      } else {
        // Force delete requested by Academic Head: delete associated schedules first
        const { error: schedDeleteErr } = await supabase
          .from('class_schedules')
          .delete()
          .eq('course_code', course.course_code)
          
        if (schedDeleteErr) {
          return NextResponse.json({ error: `Failed to delete associated schedules: ${schedDeleteErr.message}` }, { status: 500 })
        }
      }
    }

    // Delete the course
    const { error: deleteErr } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: { id, course_code: course.course_code } })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
