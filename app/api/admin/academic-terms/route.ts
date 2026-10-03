import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheDeleteByPrefix } from '@/lib/cache'

/**
 * GET /api/admin/academic-terms
 * Fetch all academic terms
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: terms, error } = await supabase
      .from('academic_terms')
      .select('*')
      .order('academic_year', { ascending: false })
      .order('term_type', { ascending: true })

    if (error) throw error

    return NextResponse.json({ terms })
  } catch (error: any) {
    console.error('Error fetching academic terms:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/academic-terms
 * Create a new academic term
 */
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

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
    } = body

    // If setting as active, deactivate other terms first
    if (is_active) {
      await supabase
        .from('academic_terms')
        .update({ is_active: false })
        .neq('id', 'placeholder') // Update all rows
    }

    const nullIfEmpty = (v: any) => (v === '' || v == null ? null : v)

    const { data: term, error } = await supabase
      .from('academic_terms')
      .insert({
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
        is_active: is_active || false,
        is_schedule_locked: false,
      })
      .select()
      .single()

    if (error) throw error

    // Bust every cached active-term shape (engine, hard-checker range, public payload)
    cacheDeleteByPrefix('booking:active_term')

    return NextResponse.json({ term })
  } catch (error: any) {
    console.error('Error creating academic term:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
