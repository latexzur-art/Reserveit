/**
 * GET /api/schedules/review/[uploadId]/entries
 * Academic Head: view all entries for a submitted upload, grouped by review status.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { uploadId } = await params
  const { searchParams } = new URL(request.url)
  const reviewStatus = searchParams.get('academic_head_review_status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(200, parseInt(searchParams.get('page_size') ?? '100'))
  const offset = (page - 1) * pageSize

  const supabase = createAdminClient()

  let query = supabase
    .from('schedule_entries_staging')
    .select('*', { count: 'exact' })
    .eq('schedule_upload_id', uploadId)
    .order('row_number', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (reviewStatus) {
    query = query.eq('academic_head_review_status', reviewStatus)
  }

  const { data: entries, count, error } = await query

  if (error) {
    console.error('[GET /api/schedules/review/.../entries] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    entries: entries ?? [],
    total: count ?? 0,
    page,
    page_size: pageSize,
  })
}
