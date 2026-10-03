/**
 * GET /api/schedules/uploads/[id]
 * Get upload detail (for both program head and academic head).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedInternal } from '@/lib/auth/guards'
import { parseUuidParam } from '@/lib/api/validate-uuid'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedInternal()
  if (authError) return authError

  const { id: rawId } = await params
  const idParse = parseUuidParam(rawId, 'upload id')
  if (!idParse.ok) return idParse.response
  const id = idParse.value
  const supabase = createAdminClient()

  const { data: upload, error } = await supabase
    .from('schedule_uploads')
    .select(`*, academic_terms(id, term_name), departments(id, name)`)
    .eq('id', id)
    .single()

  if (error) {
    console.error('[GET /api/schedules/uploads/[id]] Query error:', error.message)
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }
  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  // Access control: uploader or academic_head/building_admin
  const roles = (user.roles ?? []).map((r: { name: string }) => r.name)
  const isAdmin = roles.some((r: string) => ['academic_head', 'building_admin'].includes(r))
  if (!isAdmin && (upload as any).uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ upload })
}

/**
 * DELETE /api/schedules/uploads/[id]
 * Delete an upload (and cascade to staging entries).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedInternal()
  if (authError) return authError

  const { id } = await params
  const supabase = createAdminClient()

  const roles = (user.roles ?? []).map((r: { name: string }) => r.name)
  const isAdmin = roles.some((r: string) => ['academic_head', 'building_admin'].includes(r))
  const isProgramHead = roles.includes('program_head')

  // Ensure it exists and get status + department
  const { data: upload, error: getError } = await supabase
    .from('schedule_uploads')
    .select('upload_status, department_id, uploaded_by')
    .eq('id', id)
    .single()

  if (getError || !upload) {
    return NextResponse.json({ error: 'Upload not found or already deleted' }, { status: 404 })
  }

  const userDeptId = (user as any).department?.id as string | null

  if (!isAdmin) {
    if (!isProgramHead) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    // Program heads can delete uploads from their own department OR uploads they made themselves
    const isUploader = upload.uploaded_by === user.id
    if (upload.department_id !== userDeptId && !isUploader) {
      return NextResponse.json({ error: 'Forbidden: upload belongs to a different department.' }, { status: 403 })
    }
  }

  // Soft-delete any active class_schedules from this upload before deleting.
  // This avoids FK cascade conflicts from the conflict-prevention trigger.
  const { error: deactivateError } = await supabase
    .from('class_schedules')
    .update({
      is_active: false,
      superseded_at: new Date().toISOString(),
      supersede_reason: 'Rolled back to draft',
    })
    .eq('schedule_upload_id', id)
    .eq('is_active', true)

  if (deactivateError) {
    console.error('Error deactivating schedules before upload delete:', deactivateError)
    return NextResponse.json({ error: 'Failed to deactivate associated schedules.' }, { status: 500 })
  }

  // Delete publish log entries — FK has no ON DELETE clause so they block deletion.
  const { error: logDeleteError } = await supabase
    .from('schedule_publish_log')
    .delete()
    .eq('schedule_upload_id', id)

  if (logDeleteError) {
    console.error('Error deleting publish log before upload delete:', logDeleteError)
    return NextResponse.json({ error: 'Failed to clear publish log.' }, { status: 500 })
  }

  // Perform deletion (staging entries cascade-delete via FK ON DELETE CASCADE)
  const { error: deleteError } = await supabase
    .from('schedule_uploads')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('Error deleting upload:', deleteError)
    return NextResponse.json({ error: 'Failed to delete upload. Database error.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Upload deleted successfully' })
}
