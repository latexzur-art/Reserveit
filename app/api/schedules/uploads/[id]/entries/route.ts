/**
 * GET /api/schedules/uploads/[id]/entries
 * List entries for a specific upload with optional filters.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedInternal } from '@/lib/auth/guards'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedInternal()
  if (authError) return authError

  const { id: uploadId } = await params
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') // 'valid' | 'warning' | 'error'
  const conflictsOnly = searchParams.get('conflicts_only') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(100, parseInt(searchParams.get('page_size') ?? '50'))
  const offset = (page - 1) * pageSize

  const supabase = createAdminClient()

  // Verify access
  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select('uploaded_by')
    .eq('id', uploadId)
    .single()

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  const roles = (user.roles ?? []).map((r: { name: string }) => r.name)
  const isAdmin = roles.some((r: string) => ['academic_head', 'building_admin'].includes(r))
  if (!isAdmin && upload.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = supabase
    .from('schedule_entries_staging')
    .select(`
      *,
      is_published,
      facilities(name, room_number)
    `, { count: 'exact' })
    .eq('schedule_upload_id', uploadId)
    .order('row_number', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (statusFilter) {
    query = query.eq('validation_status', statusFilter)
  }
  if (conflictsOnly) {
    query = query.or('has_internal_conflict.eq.true,has_external_conflict.eq.true')
  }

  const { data: entries, count, error } = await query

  if (error) {
    console.error('[GET /api/schedules/uploads/[id]/entries] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    entries: entries ?? [],
    total: count ?? 0,
    page,
    page_size: pageSize,
  })
}
