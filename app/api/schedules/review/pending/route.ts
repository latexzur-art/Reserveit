/**
 * GET /api/schedules/review/pending
 * Academic Head: list all uploaded schedules awaiting review.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(_request: NextRequest) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const supabase = createAdminClient()

  const { data: uploads, error } = await supabase
    .from('schedule_uploads')
    .select(`
      id,
      upload_status,
      source_file_name,
      total_entries,
      valid_entries_count,
      warning_entries_count,
      error_entries_count,
      conflict_count,
      submitted_at,
      review_notes,
      academic_terms!inner(id, term_name, school_year, semester),
      departments!inner(id, name),
      users!uploaded_by(id, full_name, email)
    `)
    .in('upload_status', ['submitted', 'revision_requested'])
    .order('submitted_at', { ascending: true })

  if (error) {
    console.error('[GET /api/schedules/review/pending] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ uploads: uploads ?? [] })
}
