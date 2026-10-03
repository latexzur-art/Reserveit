/**
 * What a Building Admin may do to a single equipment row, keyed off the type's
 * managed_by scope. The BA equipment page renders ALL equipment (PAMO non-tech,
 * IT tech, and BA-owned HVAC), so per-row affordances must be gated by scope —
 * the server already enforces the same boundary (BA writes are locked to the
 * 'building' scope).
 *
 * Ownership matrix (plan §3):
 *   building (HVAC) -> BA owns it: edit / delete / status + report
 *   pamo (non-tech) -> BA may move (assign) + report, never edit / delete
 *   it   (tech)     -> read-only to BA: request-assign + report only
 */

export type ManagedBy = 'pamo' | 'it' | 'building'

export interface RowCapabilities {
  canEdit: boolean
  canDelete: boolean
  /** Move a non-tech item between rooms directly (logged). */
  canAssign: boolean
  /** Request a tech move that IT Admin approves/processes. */
  canRequestAssign: boolean
  canReport: boolean
  /** BA cannot mutate the item record itself (attributes/existence). */
  readOnly: boolean
}

export function equipmentRowCapabilities(managedBy: ManagedBy): RowCapabilities {
  const canEdit = managedBy === 'building'
  const canDelete = managedBy === 'building'
  return {
    canEdit,
    canDelete,
    canAssign: managedBy === 'pamo',
    canRequestAssign: managedBy === 'it',
    canReport: true,
    readOnly: !canEdit && !canDelete,
  }
}
