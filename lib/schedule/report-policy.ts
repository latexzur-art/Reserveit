/**
 * Pure authorization & state-machine policy for schedule issue reports.
 *
 *   faculty / program_head / academic_head -> may file reports
 *   building_admin                        -> may triage (transition) reports
 */

export type ScheduleReportStatus =
  | 'pending'
  | 'under_review'
  | 'resolved'
  | 'dismissed'
  | 'escalated'

const FILING_ROLES = new Set(['faculty', 'program_head', 'academic_head'])
const TRIAGE_ROLES = new Set(['building_admin'])

/** Explicit allowed transitions. Terminal states have no outgoing edges. */
export const TRANSITIONS: Record<ScheduleReportStatus, readonly ScheduleReportStatus[]> = {
  pending:      ['under_review', 'dismissed'],
  under_review: ['resolved', 'dismissed', 'escalated'],
  escalated:    ['resolved', 'dismissed', 'under_review'],
  resolved:     ['under_review'],        // re-open allowed
  dismissed:    [],                      // terminal
} as const

/** Whether the given roles may file a new schedule issue report. */
export function canFileScheduleReport(roles: string[]): boolean {
  return roles.some((r) => FILING_ROLES.has(r))
}

/** Whether the given roles may triage / transition a schedule issue report. */
export function canTriageScheduleReport(roles: string[]): boolean {
  return roles.some((r) => TRIAGE_ROLES.has(r))
}

/** Whether moving from `from` to `to` is an allowed status transition. */
export function isValidTransition(
  from: ScheduleReportStatus,
  to: ScheduleReportStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}
