import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { AdminAuditService } from '@/backend/admin'
import { notifyDirectUnassign, notifyDirectAssign } from '@/backend/schedule/assignmentNotifications'

/**
 * POST /api/schedules/reassign
 * Perform direct unassignment, reassignment, or slot conflict swap for a class schedule.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireProgramHead()
    if (authError) return authError

    const body = await request.json()
    const {
      schedule_id,
      action = 'reassign',
      new_instructor_id = null,
      new_instructor_name = null,
      conflicting_schedule_id = null,
    } = body

    if (!schedule_id) {
      return NextResponse.json({ error: 'schedule_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch target schedule details
    const { data: targetSchedule, error: targetErr } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('id', schedule_id)
      .single()

    if (targetErr || !targetSchedule) {
      return NextResponse.json({ error: 'Class schedule not found' }, { status: 404 })
    }

    const previousInstructorId = targetSchedule.instructor_id
    const previousInstructorName = targetSchedule.instructor_name

    // Action 1: Unassign professor
    if (action === 'unassign' || (action === 'reassign' && !new_instructor_id)) {
      const { error: updateErr } = await supabase
        .from('class_schedules')
        .update({
          instructor_id: null,
          instructor_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule_id)

      if (updateErr) throw updateErr

      // Audit log & Notification
      await AdminAuditService.log({
        actorId: user.id,
        action: 'unassign_instructor',
        targetType: 'class_schedule',
        targetId: schedule_id,
        details: {
          course_code: targetSchedule.course_code,
          section: targetSchedule.section,
          previous_instructor_id: previousInstructorId,
          previous_instructor_name: previousInstructorName,
        },
      }).catch(() => {})

      if (previousInstructorId) {
        void notifyDirectUnassign(supabase, previousInstructorId, targetSchedule).catch(() => {})
      }

      return NextResponse.json({
        success: true,
        action: 'unassign',
        schedule_id,
      })
    }

    // Action 2: Swap (Unassign conflicting section first, then assign target section)
    if (action === 'swap_unassign_first' && conflicting_schedule_id) {
      // Step A: Unassign conflicting section
      const { data: conflictSchedule } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('id', conflicting_schedule_id)
        .single()

      if (conflictSchedule) {
        await supabase
          .from('class_schedules')
          .update({
            instructor_id: null,
            instructor_name: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conflicting_schedule_id)

        await AdminAuditService.log({
          actorId: user.id,
          action: 'unassign_instructor',
          targetType: 'class_schedule',
          targetId: conflicting_schedule_id,
          details: {
            reason: 'Swapped for reassignment',
            course_code: conflictSchedule.course_code,
            section: conflictSchedule.section,
            previous_instructor_id: conflictSchedule.instructor_id,
            previous_instructor_name: conflictSchedule.instructor_name,
          },
        }).catch(() => {})

        if (conflictSchedule.instructor_id) {
          void notifyDirectUnassign(supabase, conflictSchedule.instructor_id, conflictSchedule).catch(() => {})
        }
      }

      // Step B: Assign target section
      const { error: assignErr } = await supabase
        .from('class_schedules')
        .update({
          instructor_id: new_instructor_id,
          instructor_name: new_instructor_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule_id)

      if (assignErr) throw assignErr

      await AdminAuditService.log({
        actorId: user.id,
        action: 'reassign_instructor',
        targetType: 'class_schedule',
        targetId: schedule_id,
        details: {
          course_code: targetSchedule.course_code,
          section: targetSchedule.section,
          previous_instructor_id: previousInstructorId,
          new_instructor_id,
          new_instructor_name,
          swapped_from_schedule_id: conflicting_schedule_id,
        },
      }).catch(() => {})

      if (previousInstructorId && previousInstructorId !== new_instructor_id) {
        void notifyDirectUnassign(supabase, previousInstructorId, targetSchedule).catch(() => {})
      }
      if (new_instructor_id) {
        void notifyDirectAssign(supabase, new_instructor_id, targetSchedule).catch(() => {})
      }

      return NextResponse.json({
        success: true,
        action: 'swap_unassign_first',
        schedule_id,
        unassigned_schedule_id: conflicting_schedule_id,
      })
    }

    // Action 3: Standard Reassign (Check conflict first unless forced)
    if (new_instructor_id) {
      // Check for slot conflict
      const { data: conflicts } = await supabase
        .from('class_schedules')
        .select('id, course_code, course_name, section, day_of_week, start_time, end_time')
        .eq('instructor_id', new_instructor_id)
        .eq('day_of_week', targetSchedule.day_of_week)
        .eq('is_active', true)
        .neq('id', schedule_id)

      const hasOverlap = (conflicts ?? []).find(
        (c) => c.start_time < targetSchedule.end_time && c.end_time > targetSchedule.start_time
      )

      if (hasOverlap && !body.force) {
        return NextResponse.json(
          {
            conflict: true,
            error: 'Professor has a schedule conflict',
            conflicting_schedule: hasOverlap,
          },
          { status: 409 }
        )
      }

      const { error: updateErr } = await supabase
        .from('class_schedules')
        .update({
          instructor_id: new_instructor_id,
          instructor_name: new_instructor_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule_id)

      if (updateErr) throw updateErr

      await AdminAuditService.log({
        actorId: user.id,
        action: 'reassign_instructor',
        targetType: 'class_schedule',
        targetId: schedule_id,
        details: {
          course_code: targetSchedule.course_code,
          section: targetSchedule.section,
          previous_instructor_id: previousInstructorId,
          new_instructor_id,
          new_instructor_name,
        },
      }).catch(() => {})

      if (previousInstructorId && previousInstructorId !== new_instructor_id) {
        void notifyDirectUnassign(supabase, previousInstructorId, targetSchedule).catch(() => {})
      }
      if (new_instructor_id) {
        void notifyDirectAssign(supabase, new_instructor_id, targetSchedule).catch(() => {})
      }

      return NextResponse.json({
        success: true,
        action: 'reassign',
        schedule_id,
      })
    }

    return NextResponse.json({ error: 'Invalid action payload' }, { status: 400 })
  } catch (error: any) {
    console.error('[POST /api/schedules/reassign]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
