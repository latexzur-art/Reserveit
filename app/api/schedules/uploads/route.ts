/**
 * GET /api/schedules/uploads
 * Program Head: list their own uploads with summary stats.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const termId = searchParams.get('academic_term_id')
  const statusParam = searchParams.get('status')

  const supabase = createAdminClient()

  const roles = (user.roles ?? []).map((r: any) => r.name)
  const isAdmin = roles.some((r: string) => ['academic_head', 'building_admin'].includes(r))
  const departmentId = (user as any).department?.id as string | null

  let query = supabase
    .from('schedule_uploads')
    .select(`
      id,
      upload_mode,
      upload_status,
      source_file_name,
      total_entries,
      valid_entries_count,
      warning_entries_count,
      error_entries_count,
      conflict_count,
      submitted_at,
      reviewed_at,
      review_notes,
      created_at,
      uploaded_by,
      academic_terms(id, term_name, academic_year, term_type),
      departments(id, name),
      users!uploaded_by(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    // Show uploads the user created OR any upload belonging to their department
    if (departmentId) {
      query = query.or(`uploaded_by.eq.${user.id},department_id.eq.${departmentId}`)
    } else {
      query = query.eq('uploaded_by', user.id)
    }
  }

  if (termId) {
    query = query.eq('academic_term_id', termId)
  }
  if (statusParam) {
    query = query.eq('upload_status', statusParam)
  }

  const { data: uploads, error } = await query

  if (error) {
    console.error('[GET /api/schedules/uploads] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ uploads: uploads ?? [] })
}
