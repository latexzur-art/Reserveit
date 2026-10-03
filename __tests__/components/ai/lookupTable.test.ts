import { describe, it, expect } from 'vitest'
import { toDisplayTable, humanizeKey, formatCell, humanizeEnumValue, buildLookupView } from '@/components/ai/chatbot/helpers'

const hvac = [
  { id: '07410e3d-2f14-4282-b194-0b6f24390647', equipmentCode: 'HVAC-001', equipmentName: 'Carrier Split-type', equipmentType: 'Split-type 2.0HP', status: 'available', assignedRoom: 'Room 201' },
  { id: 'ea851248-7627-4c21-9c91-64104d6bb82d', equipmentCode: 'HVAC-002', equipmentName: 'Carrier Split-type', equipmentType: 'Split-type 2.0HP', status: 'available', assignedRoom: null },
]

describe('humanizeKey', () => {
  it('turns camelCase and snake_case into Title Case', () => {
    expect(humanizeKey('equipmentCode')).toBe('Equipment Code')
    expect(humanizeKey('assigned_room')).toBe('Assigned Room')
    expect(humanizeKey('status')).toBe('Status')
  })
})

describe('formatCell', () => {
  it('renders friendly placeholders and typed values', () => {
    expect(formatCell(null)).toBe('—')
    expect(formatCell(undefined)).toBe('—')
    expect(formatCell('')).toBe('—')
    expect(formatCell(true)).toBe('Yes')
    expect(formatCell(false)).toBe('No')
    expect(formatCell(42)).toBe('42')
    expect(formatCell('Room 201')).toBe('Room 201')
  })
})

describe('toDisplayTable', () => {
  it('builds columns from object keys but hides internal ids', () => {
    const t = toDisplayTable(hvac)
    expect(t).not.toBeNull()
    const keys = t!.headers.map((h) => h.key)
    expect(keys).not.toContain('id')
    expect(keys).toContain('equipmentCode')
    expect(keys).toContain('status')
    expect(t!.total).toBe(2)
  })

  it('humanizes the headers', () => {
    const labels = toDisplayTable(hvac)!.headers.map((h) => h.label)
    expect(labels).toContain('Equipment Code')
    expect(labels).toContain('Status')
  })

  it('drops a column whose values are all UUIDs even when the key is not id-like', () => {
    const rows = [
      { token: '07410e3d-2f14-4282-b194-0b6f24390647', name: 'A' },
      { token: 'ea851248-7627-4c21-9c91-64104d6bb82d', name: 'B' },
    ]
    const keys = toDisplayTable(rows)!.headers.map((h) => h.key)
    expect(keys).not.toContain('token')
    expect(keys).toContain('name')
  })

  it('returns null when the rows are not objects (caller keeps its list rendering)', () => {
    expect(toDisplayTable(['a', 'b'])).toBeNull()
    expect(toDisplayTable([])).toBeNull()
  })
})

describe('humanizeEnumValue', () => {
  it('converts strict snake_case enum tokens to Title Case', () => {
    expect(humanizeEnumValue('program_head')).toBe('Program Head')
    expect(humanizeEnumValue('auto_approve')).toBe('Auto Approve')
    expect(humanizeEnumValue('school_event')).toBe('School Event')
  })

  it('leaves emails, codes, and plain words untouched', () => {
    expect(humanizeEnumValue('ana@x.edu')).toBe('ana@x.edu')
    expect(humanizeEnumValue('HVAC-001')).toBe('HVAC-001')
    expect(humanizeEnumValue('active')).toBe('active')
    expect(humanizeEnumValue('Room 201')).toBe('Room 201')
    expect(humanizeEnumValue('Program Head')).toBe('Program Head')
  })

  it('does not convert mixed-case or uppercase snake_case', () => {
    expect(humanizeEnumValue('Program_Head')).toBe('Program_Head')
    expect(humanizeEnumValue('AUTO_APPROVE')).toBe('AUTO_APPROVE')
  })
})

describe('buildLookupView', () => {
  it('returns error kind when result has .error', () => {
    const view = buildLookupView('get_roles', { error: 'Not found' })
    expect(view.kind).toBe('error')
    if (view.kind === 'error') {
      expect(view.message).toBe('Not found')
    }
  })

  it('returns person kind for view_person with { person, facets }', () => {
    const result = {
      person: {
        id: '07410e3d-2f14-4282-b194-0b6f24390647',
        name: 'Marcus Soler',
        email: 'marcus@x.edu',
        role: 'program_head',
        departmentId: 'dept-123',
        source: 'users',
      },
      facets: {
        bookings: [{ reference: 'BK-001', status: 'approved', date: '2025-06-15' }],
        schedule: { error: 'no schedule found' },
      },
    }
    const view = buildLookupView('view_person', result)
    expect(view.kind).toBe('person')
    if (view.kind === 'person') {
      // Fields should NOT contain id, departmentId, or source
      const fieldLabels = view.fields.map(([k]) => k)
      expect(fieldLabels).not.toContain('Id')
      expect(fieldLabels).not.toContain('Department Id')
      expect(fieldLabels).not.toContain('Source')
      // Fields SHOULD contain Name, Email, Role
      expect(fieldLabels).toContain('Name')
      expect(fieldLabels).toContain('Email')
      expect(fieldLabels).toContain('Role')
      // Role should be humanized
      const roleField = view.fields.find(([k]) => k === 'Role')
      expect(roleField![1]).toBe('Program Head')
      // Facets become sections
      expect(view.sections).toHaveLength(2)
      expect(view.sections[0].name).toBe('Bookings')
      expect(view.sections[0].content.kind).toBe('table')
      expect(view.sections[1].name).toBe('Schedule')
      expect(view.sections[1].content.kind).toBe('error')
    }
  })

  it('returns table kind for arrays', () => {
    const result = [
      { id: 'u1', name: 'Alice', email: 'a@x.edu', status: 'active' },
      { id: 'u2', name: 'Bob', email: 'b@x.edu', status: 'inactive' },
    ]
    const view = buildLookupView('search_users', result)
    expect(view.kind).toBe('table')
    if (view.kind === 'table') {
      expect(view.label).toBe('Users')
      expect(view.table.total).toBe(2)
      // id column should be hidden
      const keys = view.table.headers.map((h) => h.key)
      expect(keys).not.toContain('id')
      expect(keys).toContain('name')
    }
  })

  it('returns record kind for a single object with displayable scalars', () => {
    const result = { name: 'Main Gym', capacity: 200, status: 'available' }
    const view = buildLookupView('get_facility_status', result)
    expect(view.kind).toBe('record')
    if (view.kind === 'record') {
      const labels = view.pairs.map(([k]) => k)
      expect(labels).toContain('Name')
      expect(labels).toContain('Capacity')
    }
  })

  it('returns empty kind for ids-only objects (not JSON)', () => {
    const result = {
      id: '07410e3d-2f14-4282-b194-0b6f24390647',
      user_id: 'ea851248-7627-4c21-9c91-64104d6bb82d',
    }
    const view = buildLookupView('get_roles', result)
    expect(view.kind).toBe('empty')
  })

  it('returns empty kind for null/undefined results', () => {
    expect(buildLookupView('get_roles', null).kind).toBe('empty')
    expect(buildLookupView('get_roles', undefined).kind).toBe('empty')
  })

  it('applies enum humanization in person fields', () => {
    const result = {
      person: { name: 'Test', role: 'academic_head', status: 'auto_approve' },
      facets: {},
    }
    const view = buildLookupView('view_person', result)
    if (view.kind === 'person') {
      const roleVal = view.fields.find(([k]) => k === 'Role')?.[1]
      expect(roleVal).toBe('Academic Head')
      const statusVal = view.fields.find(([k]) => k === 'Status')?.[1]
      expect(statusVal).toBe('Auto Approve')
    }
  })

  it('person facets: empty array → empty, empty object → empty', () => {
    const result = {
      person: { name: 'Test' },
      facets: { bookings: [], payments: {} },
    }
    const view = buildLookupView('view_person', result)
    if (view.kind === 'person') {
      expect(view.sections[0].content.kind).toBe('empty')
      expect(view.sections[1].content.kind).toBe('empty')
    }
  })
})
