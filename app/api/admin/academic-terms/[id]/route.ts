import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheDeleteByPrefix } from '@/lib/cache'

/**
 * PATCH /api/admin/academic-terms/[id]
 * Update an academic term
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const { id } = await params

    const {
      term_code,
      term_name,
      academic_year,
      term_type,
      start_date,
      end_date,
      enrollment_start,
      enrollment_end,
      exam_start,
      exam_end,
      is_active,
      is_schedule_locked,
    } = body

    // If setting as active, deactivate other terms first
    if (is_active) {
      await supabase
        .from('academic_terms')
        .update({ is_active: false })
        .neq('id', id)
    }

    const nullIfEmpty = (v: any) => (v === '' || v == null ? null : v)

    const { data: term, error } = await supabase
      .from('academic_terms')
      .update({
        term_code,
        term_name,
        academic_year,
        term_type,
        start_date,
        end_date,
        enrollment_start: nullIfEmpty(enrollment_start),
        enrollment_end:   nullIfEmpty(enrollment_end),
        exam_start:       nullIfEmpty(exam_start),
        exam_end:         nullIfEmpty(exam_end),
        is_active,
        is_schedule_locked,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Bust every cached active-term shape (engine, hard-checker range, public payload)
    cacheDeleteByPrefix('booking:active_term')

    return NextResponse.json({ term })
  } catch (error: any) {
    console.error('Error updating academic term:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/academic-terms/[id]
 * Delete an academic term
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const { id } = await params

    const { error } = await supabase
      .from('academic_terms')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Bust every cached active-term shape — deleted term may have been the active one
    cacheDeleteByPrefix('booking:active_term')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting academic term:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
