export type GroupActionKind =
  | 'approve'
  | 'reject'
  | 'withdraw'
  | 'cancel'
  | 'request_cancellation'
  | 'confirm_cancellation'
  | 'decline_cancellation'
  | 'legacy_approve'
  | 'legacy_reject'
  | 'legacy_cancel'
  | 'legacy_delete'

export interface GroupActionsResult {
  actions: GroupActionKind[]
  readOnlyMessage?: string
}

export type ScheduleEventViewerRole = 'academic_head' | 'building_admin'

/**
 * Role- and status-conditional action button matrix, per spec §7. Ungrouped legacy
 * (Program-Head-submitted) rows keep today's exact behavior, unchanged, for either viewer role --
 * this table applies to grouped AH/BA rows only.
 */
export function resolveGroupActions(
  group: { group_id: string | null; current_status: string; created_by_id?: string },
  viewerRole: ScheduleEventViewerRole,
  viewerUserId: string
): GroupActionsResult {
  if (group.group_id === null) {
    if (group.current_status === 'pending') return { actions: ['legacy_approve', 'legacy_reject'] }
    if (group.current_status === 'auto_approved') return { actions: ['legacy_cancel', 'legacy_delete'] }
    return { actions: [] }
  }

  const isBA = viewerRole === 'building_admin'
  const isOwn = group.created_by_id === viewerUserId

  if (group.current_status === 'pending') {
    if (isBA) return { actions: ['approve', 'reject'] }
    if (isOwn) return { actions: ['withdraw'], readOnlyMessage: 'Awaiting Building Admin approval' }
    return { actions: [] }
  }

  if (group.current_status === 'auto_approved') {
    return { actions: [isBA ? 'cancel' : 'request_cancellation'] }
  }

  if (group.current_status === 'cancellation_requested') {
    if (isBA) return { actions: ['confirm_cancellation', 'decline_cancellation'] }
    if (isOwn) return { actions: [], readOnlyMessage: 'Awaiting Building Admin confirmation' }
    return { actions: [] }
  }

  return { actions: [] }
}
