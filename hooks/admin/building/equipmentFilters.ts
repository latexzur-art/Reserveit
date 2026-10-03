// Client-side filtering for the grouped equipment inventory.
//
// The equipment API already fetches and groups the full active set on every
// request (no DB-level pagination), so re-hitting the server on every keystroke
// or filter click bought nothing but network latency. We fetch the grouped set
// once and narrow it here, in memory, which is instant for a single school's
// inventory. Kept as a pure function so it is trivially testable and reused by
// both the Building equipment page and the PAMO/IT EquipmentManager.

export interface EquipmentGroupFilterCriteria {
  /** Free-text match over name, code, brand, and location. */
  search?: string
  /** equipmentTypeId; '' or 'all' means no filter. */
  category?: string
  /** currentStatusId; '' or 'all' means no filter. */
  status?: string
  /** 'pamo' | 'it' | 'building'; '' or 'all' means no filter. */
  scope?: string
  /** 'assigned' | 'unassigned'; '' or 'all' means no filter. */
  assignment?: string
}

export interface FilterableEquipmentGroup {
  equipmentName?: string | null
  equipmentCode?: string | null
  displayCode?: string | null
  assignedFacilityName?: string | null
  assignedFacilityId?: string | null
  brand?: string | null
  equipmentTypeId?: string | null
  currentStatusId?: string | null
  managedBy?: string | null
}

const isActive = (value?: string) => !!value && value !== 'all'

export function filterEquipmentGroups<T extends FilterableEquipmentGroup>(
  groups: T[],
  criteria: EquipmentGroupFilterCriteria,
): T[] {
  const { search, category, status, scope, assignment } = criteria
  const term = search?.trim().toLowerCase()

  return groups.filter(group => {
    if (isActive(category) && group.equipmentTypeId !== category) return false
    if (isActive(status) && group.currentStatusId !== status) return false
    if (isActive(scope) && group.managedBy !== scope) return false

    if (isActive(assignment)) {
      const assigned = group.assignedFacilityId != null
      if (assignment === 'assigned' && !assigned) return false
      if (assignment === 'unassigned' && assigned) return false
    }

    if (term) {
      const haystack = [
        group.equipmentName,
        group.equipmentCode,
        group.displayCode,
        group.brand,
        group.assignedFacilityName,
      ]
      const hit = haystack.some(field => field?.toLowerCase().includes(term))
      if (!hit) return false
    }

    return true
  })
}
