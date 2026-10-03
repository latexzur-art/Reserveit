/**
 * Pure authorization policy for handling equipment issue reports.
 *
 *   building_admin -> front-line, may transition any report
 *   pamo_officer   -> may handle escalated NON-tech reports
 *   it_admin   -> may handle escalated TECH reports
 */

export type ReportStatus =
  | 'open'
  | 'under_process'
  | 'resolved'
  | 'still_broken'
  | 'escalated'

// Statuses the owning office (PAMO/IT) is allowed to act on: an escalated
// report and the in-progress states it moves through afterward. Without
// under_process/still_broken here, the office is locked out of its own report
// the moment it moves it off 'escalated'.
const OFFICE_HANDLEABLE = new Set(['escalated', 'under_process', 'still_broken'])

export function canHandleReport(
  roles: string[],
  isTech: boolean,
  status: ReportStatus | string,
): boolean {
  if (roles.includes('building_admin')) return true
  if (roles.includes('pamo_officer') && !isTech && OFFICE_HANDLEABLE.has(status)) return true
  if (roles.includes('it_admin') && isTech && OFFICE_HANDLEABLE.has(status)) return true
  return false
}
