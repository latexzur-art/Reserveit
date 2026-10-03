import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const BulkDeleteSchema = z.object({
  courseIds: z.array(z.string().uuid()),
  force: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head') && !roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BulkDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { courseIds } = parsed.data
  if (courseIds.length === 0) {
    return NextResponse.json({ success: true, deleted: 0, skipped: 0 })
  }

  try {
    const supabase = createAdminClient()

    // Find the course codes for these IDs
    const { data: coursesData, error: coursesErr } = await supabase
      .from('courses')
      .select('id, course_code')
      .in('id', courseIds)

    if (coursesErr) {
      return NextResponse.json({ error: coursesErr.message }, { status: 500 })
    }

    if (!coursesData || coursesData.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, skipped: 0, message: 'No valid courses found.' })
    }

    const courseCodes = coursesData.map(c => c.course_code)

    // Find which courses have schedules attached (cannot be deleted)
    const { data: schedules, error: schedErr } = await supabase
      .from('class_schedules')
      .select('course_code')
      .in('course_code', courseCodes)

    if (schedErr) {
      return NextResponse.json({ error: schedErr.message }, { status: 500 })
    }

    const codesWithSchedules = new Set(schedules?.map(s => s.course_code) || [])
    
    if (codesWithSchedules.size > 0) {
      const isAcademicHead = roles.includes('academic_head')

      if (!parsed.data.force) {
        return NextResponse.json(
          { 
            error: `Cannot delete because ${codesWithSchedules.size} course(s) have active schedules. ${!isAcademicHead ? 'Please ask an Academic Head to remove them.' : ''}`, 
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
        // Force delete requested by Academic Head: delete all associated schedules first
        const codesArray = Array.from(codesWithSchedules)
        const { error: schedDeleteErr } = await supabase
          .from('class_schedules')
          .delete()
          .in('course_code', codesArray)
          
        if (schedDeleteErr) {
          return NextResponse.json({ error: `Failed to delete associated schedules: ${schedDeleteErr.message}` }, { status: 500 })
        }
      }
    }

    // Since we forced deletion of schedules, all courseIds are now safe to delete
    // If not forced, codesWithSchedules.size is 0, so also all are safe.
    const safeToDeleteIds = coursesData.map(c => c.id)

    let deletedCount = 0
    if (safeToDeleteIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from('courses')
        .delete()
        .in('id', safeToDeleteIds)

      if (deleteErr) {
        return NextResponse.json({ error: deleteErr.message }, { status: 500 })
      }
      deletedCount = safeToDeleteIds.length
    }

    const skippedCount = coursesData.length - deletedCount

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      skipped: skippedCount,
      message: `Successfully deleted ${deletedCount} course(s).${skippedCount > 0 ? ` Skipped ${skippedCount} course(s) that are in use by schedules.` : ''}`
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
