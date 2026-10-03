/**
 * Equipment scope policy — which `managed_by` scopes each role may act on,
 * per capability. Enforcement companion to the guards in `./guards`.
 *
 *   pamo     -> non-tech assets (PAMO)
 *   it       -> tech assets (IT Admin / it_admin)
 *   building -> building fixtures / HVAC (Building Admin)
 */

export type ManagedBy = 'pamo' | 'it' | 'building'
export type EquipmentRole = 'pamo_officer' | 'it_admin' | 'building_admin'

export interface EquipmentCapabilities {
  /** Scopes the role may create/edit/delete/bulk-import. */
  write: ManagedBy[]
  /** Scopes the role may directly assign/move (logged). */
  assign: ManagedBy[]
  /** Scopes the role may read. */
  read: ManagedBy[]
  /** Scopes the role may submit an assignment *request* for (BA -> IT). */
  requestAssign: ManagedBy[]
}

const NONE: ManagedBy[] = []

export const EQUIPMENT_CAPABILITIES: Record<string, EquipmentCapabilities> = {
  pamo_officer: {
    write: ['pamo'],
    assign: ['pamo'],
    read: ['pamo'],
    requestAssign: NONE,
  },
  pamo: {
    write: ['pamo'],
    assign: ['pamo'],
    read: ['pamo'],
    requestAssign: NONE,
  },
  it_admin: {
    write: ['it'],
    assign: ['it'],
    read: ['it'],
    requestAssign: NONE,
  },
  building_admin: {
    write: ['building'],
    assign: ['pamo', 'building'],
    read: ['pamo', 'it', 'building'],
    requestAssign: ['it'],
  },
}

/**
 * Scopes a Building Admin may directly assign/unassign through the per-facility
 * equipment route (`/api/admin/building/facilities/[id]/equipment`): non-tech
 * (pamo) and its own HVAC (building). Tech (it) stays out — it must go through
 * the IT assignment-request flow. Derived from the authoritative capability map
 * so the route can never silently drift from policy (a stale `['pamo']` here
 * 403s every aircon assignment).
 */
export const BA_FACILITY_ASSIGN_SCOPE: ManagedBy[] = [
  ...EQUIPMENT_CAPABILITIES.building_admin.assign,
]

/** True if `role` may perform `capability` on the given `managedBy` scope. */
export function canActOnScope(
  role: EquipmentRole,
  capability: keyof EquipmentCapabilities,
  managedBy: ManagedBy,
): boolean {
  return EQUIPMENT_CAPABILITIES[role]?.[capability].includes(managedBy) ?? false
}
