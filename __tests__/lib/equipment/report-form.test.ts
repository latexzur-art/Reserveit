import { describe, it, expect } from 'vitest'
import { buildIssueReportPayload, roomsFromClasses } from '@/lib/equipment/report-form'

describe('buildIssueReportPayload', () => {
  it('includes facilityId and equipmentId when a room + equipment are selected', () => {
    const payload = buildIssueReportPayload({
      category: 'broken',
      description: 'Projector will not power on',
      facilityId: 'fac-1',
      equipmentId: 'eq-9',
    })
    expect(payload.facilityId).toBe('fac-1')
    expect(payload.equipmentId).toBe('eq-9')
    expect(payload.category).toBe('broken')
    expect(payload.description).toBe('Projector will not power on')
  })

  it('includes facilityId only when a room is chosen but no specific item', () => {
    const payload = buildIssueReportPayload({
      category: 'malfunction',
      description: 'AC leaking',
      facilityId: 'fac-2',
    })
    expect(payload.facilityId).toBe('fac-2')
    expect(payload.equipmentId).toBeUndefined()
  })

  it('omits structured fields and prepends the free-text location when nothing is selected', () => {
    const payload = buildIssueReportPayload({
      category: 'missing',
      description: 'Remote is gone',
      location: 'Room 301 · PROJ-002',
    })
    expect(payload.facilityId).toBeUndefined()
    expect(payload.equipmentId).toBeUndefined()
    expect(payload.description).toBe('[Room 301 · PROJ-002] Remote is gone')
  })

  it('does not double-wrap the location when a structured facility is present', () => {
    const payload = buildIssueReportPayload({
      category: 'broken',
      description: 'Screen cracked',
      facilityId: 'fac-3',
      location: 'ignored free text',
    })
    // Structured facility wins; free-text location is not appended.
    expect(payload.description).toBe('Screen cracked')
    expect(payload.facilityId).toBe('fac-3')
  })
})

describe('roomsFromClasses', () => {
  // Shape of GET /api/schedules/my-classes: each class carries a flattened
  // `facility` object; a class with no assigned room has facility.id === null
  // and name 'Unknown'.
  const mkClass = (facilityId: string | null, name: string, roomNumber = '', building = '') => ({
    id: `cls-${Math.random()}`,
    facility: { id: facilityId, name: facilityId ? name : 'Unknown', room_number: roomNumber, building },
  })

  it('returns one entry per distinct room from the instructor schedule', () => {
    const rooms = roomsFromClasses([
      mkClass('fac-1', 'Room 302', '302'),
      mkClass('fac-1', 'Room 302', '302'), // same room, another class
      mkClass('fac-2', 'Lab A', 'L1'),
    ])
    expect(rooms).toHaveLength(2)
    expect(rooms.map((r) => r.facilityId).sort()).toEqual(['fac-1', 'fac-2'])
  })

  it('skips classes with no assigned facility', () => {
    const rooms = roomsFromClasses([
      mkClass(null, ''),
      mkClass('fac-9', 'Room 500', '500'),
    ])
    expect(rooms).toHaveLength(1)
    expect(rooms[0].facilityId).toBe('fac-9')
  })

  it('builds a human label from the facility name (and building when present)', () => {
    const rooms = roomsFromClasses([mkClass('fac-1', 'Room 302', '302', 'Main Bldg')])
    expect(rooms[0].label).toContain('Room 302')
    expect(rooms[0].label).toContain('Main Bldg')
  })

  it('tolerates a raw supabase row (facilities join as a single-element array)', () => {
    const rooms = roomsFromClasses([
      { id: 'c1', facility_id: 'fac-7', facilities: [{ id: 'fac-7', name: 'Room 707', room_number: '707' }] },
    ])
    expect(rooms).toHaveLength(1)
    expect(rooms[0].facilityId).toBe('fac-7')
    expect(rooms[0].label).toContain('Room 707')
  })
})
