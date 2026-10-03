/**
 * Pure state-machine policy for tech equipment assignment requests.
 * Flow: pending -> approved -> in_progress -> completed, with rejected
 * reachable from any non-terminal state.
 */

export type RequestStatus = 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected'

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['in_progress', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: [],
}

/** The statuses a request in `status` may advance to. */
export function nextRequestStatuses(status: RequestStatus | string): RequestStatus[] {
  return TRANSITIONS[status as RequestStatus] ?? []
}

/** Whether `from -> to` is a permitted transition. */
export function isRequestTransitionAllowed(
  from: RequestStatus | string,
  to: RequestStatus | string,
): boolean {
  return nextRequestStatuses(from).includes(to as RequestStatus)
}
