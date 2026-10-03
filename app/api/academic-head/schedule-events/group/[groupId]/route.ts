import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin, requireBuildingAdminStrict } from '@/lib/auth/guards'
import { approveGroup, rejectGroup, withdrawGroup, type ActionResult } from '@/backend/schedule-events/scheduleEventGroupActions'
import {
  requestOrExecuteCancellation,
  confirmCancellation,
  declineCancellation,
  deleteGroup,
} from '@/backend/schedule-events/scheduleEventGroupCancellation'
import { resolveActorRole } from '@/backend/schedule-events/scheduleEventGroupHelpers'

const STATUS_FOR_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  INVALID_STATUS: 400,
  FORBIDDEN: 403,
  VALIDATION: 400,
}

function respond(result: ActionResult<any>) {
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: STATUS_FOR_CODE[result.code] ?? 400 })
  }
  return NextResponse.json({ success: true, ...(result.data ?? {}) })
}

const BA_ONLY_ACTIONS = new Set(['approve', 'reject', 'confirm_cancellation', 'decline_cancellation'])
const AH_OR_BA_ACTIONS = new Set(['request_cancellation', 'withdraw'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const body = await request.json().catch(() => ({}))
  const { action } = body

  if (BA_ONLY_ACTIONS.has(action)) {
    const { error, user } = await requireBuildingAdminStrict()
    if (error) return error

    const supabase = createAdminClient()
    const approverName = user!.full_name ?? user!.email ?? 'Building Admin'

    if (action === 'approve') return respond(await approveGroup(supabase, groupId, user!.id, approverName))
    if (action === 'reject') return respond(await rejectGroup(supabase, groupId, user!.id, approverName, body.reason))
    if (action === 'confirm_cancellation') return respond(await confirmCancellation(supabase, groupId, user!.id, approverName))
    return respond(await declineCancellation(supabase, groupId, user!.id, approverName))
  }

  if (AH_OR_BA_ACTIONS.has(action)) {
    const { error, user } = await requireAcademicHeadOrBuildingAdmin()
    if (error) return error

    const supabase = createAdminClient()

    if (action === 'withdraw') return respond(await withdrawGroup(supabase, groupId, user!.id))

    const actorRole = resolveActorRole(user!)
    const actorName = user!.full_name ?? user!.email ?? 'User'
    return respond(await requestOrExecuteCancellation(supabase, groupId, actorRole, user!.id, actorName))
  }

  return NextResponse.json(
    { error: "action must be one of: approve, reject, request_cancellation, confirm_cancellation, decline_cancellation, withdraw" },
    { status: 400 }
  )
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { error } = await requireBuildingAdminStrict()
  if (error) return error

  const { groupId } = await params
  const supabase = createAdminClient()
  return respond(await deleteGroup(supabase, groupId))
}
