import { describe, it, expect } from 'vitest'
import { equipmentRowCapabilities } from '@/lib/equipment/row-capabilities'

// What a Building Admin may do to a given equipment row, keyed off the type's
// managed_by scope. Mirrors the ownership matrix in the PAMO/IT/Building plan §3:
//   building (HVAC) -> BA owns it: edit/delete/status + report
//   pamo (non-tech) -> BA may move (assign) + report, never edit/delete
//   it   (tech)     -> read-only to BA: request-assign + report only
describe('equipmentRowCapabilities (Building Admin perspective)', () => {
  it('grants full control over BA-owned HVAC (building scope)', () => {
    const c = equipmentRowCapabilities('building')
    expect(c.canEdit).toBe(true)
    expect(c.canDelete).toBe(true)
    expect(c.canReport).toBe(true)
    expect(c.readOnly).toBe(false)
    expect(c.canRequestAssign).toBe(false)
  })

  it('lets BA move + report non-tech (pamo) but never edit or delete it', () => {
    const c = equipmentRowCapabilities('pamo')
    expect(c.canEdit).toBe(false)
    expect(c.canDelete).toBe(false)
    expect(c.canAssign).toBe(true)
    expect(c.canRequestAssign).toBe(false)
    expect(c.canReport).toBe(true)
    expect(c.readOnly).toBe(true)
  })

  it('keeps tech (it) read-only to BA: request-assign + report only', () => {
    const c = equipmentRowCapabilities('it')
    expect(c.canEdit).toBe(false)
    expect(c.canDelete).toBe(false)
    expect(c.canAssign).toBe(false)
    expect(c.canRequestAssign).toBe(true)
    expect(c.canReport).toBe(true)
    expect(c.readOnly).toBe(true)
  })

  it('never marks a row read-only while also granting edit/delete', () => {
    for (const scope of ['pamo', 'it', 'building'] as const) {
      const c = equipmentRowCapabilities(scope)
      expect(c.readOnly).toBe(!c.canEdit && !c.canDelete)
    }
  })
})
