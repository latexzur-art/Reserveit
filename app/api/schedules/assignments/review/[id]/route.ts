/**
 * POST  /api/schedules/assignments/review/[id] — approve or reject a lineup
 *        Body: { action: 'approve' | 'reject', notes?: string }
 * PATCH /api/schedules/assignments/review/[id] — override one item's proposed
 *        professor before approving. Body: { item_id, proposed_instructor_id, proposed_instructor_name }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { notifyRequesterDecision, notifyAssignedProfessors } from '@/backend/schedule/assignmentNotifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { id } = await params
  const { action, notes } = await request.json()

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
  }
  if (action === 'reject' && (!notes || notes.trim().length < 5)) {
    return NextResponse.json({ error: 'Rejection requires notes (min 5 chars)' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: lineup } = await supabase
    .from('professor_assignment_lineups')
    .select('created_by')
    .eq('id', id)
    .single()
  if (!lineup) return NextResponse.json({ error: 'Lineup not found' }, { status: 404 })

  if (action === 'approve') {
    const { data: result, error } = await supabase.rpc('approve_assignment_lineup', {
      p_lineup_id: id, p_reviewer_id: user.id, p_notes: notes ?? null,
    })
    if (error) {
      console.error('[POST assignments/review] approve:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Notify the requester (in-app + email) and each assigned professor.
    await notifyRequesterDecision(supabase, lineup.created_by, true, {
      lineupId: id, applied: result?.applied ?? 0, skipped: result?.skipped ?? 0, notes,
    })
    await notifyAssignedProfessors(supabase, id)
    return NextResponse.json({ success: true, result })
  }

  const { data: result, error } = await supabase.rpc('reject_assignment_lineup', {
    p_lineup_id: id, p_reviewer_id: user.id, p_notes: notes,
  })
  if (error) {
    console.error('[POST assignments/review] reject:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await notifyRequesterDecision(supabase, lineup.created_by, false, { lineupId: id, notes })
  return NextResponse.json({ success: true, result })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { id } = await params
  const { item_id, proposed_instructor_id, proposed_instructor_name } = await request.json()
  if (!item_id || !proposed_instructor_name) {
    return NextResponse.json({ error: 'item_id and proposed_instructor_name required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('professor_assignment_items')
    .update({
      proposed_instructor_id: proposed_instructor_id ?? null,
      proposed_instructor_name,
      status: 'pending',
      conflict_details: null,
    })
    .eq('id', item_id)
    .eq('lineup_id', id)

  if (error) {
    console.error('[PATCH assignments/review]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
