import { describe, it, expect } from 'vitest'
import { planViewPerson, assembleViewPerson } from '@/backend/ai/tools/viewPerson'

describe('planViewPerson — role-scoped facet routing', () => {
  it('gives the Academic Head the richest plan (schedule, bookings, reliability)', () => {
    const plan = planViewPerson('academic_head')
    expect(plan).not.toBeNull()
    expect(plan!.directory.path).toContain('academic-staff')
    expect(plan!.facets.map((f) => f.name)).toEqual(['schedule', 'bookings', 'reliability'])
  })

  it('routes the Building Admin through the people directory (bookings/schedules/payments)', () => {
    const plan = planViewPerson('building_admin')
    expect(plan!.directory.path).toContain('admin/building/directory')
    expect(plan!.facets.map((f) => f.name).sort()).toEqual(['bookings', 'payments', 'schedules'])
  })

  it('gives the IT Admin a profile-only plan via admin/users', () => {
    const plan = planViewPerson('it_admin')
    expect(plan!.directory.path).toContain('admin/users')
    expect(plan!.facets).toEqual([])
  })

  it('routes the Program Head through the instructors directory (no server-side search param)', () => {
    const plan = planViewPerson('program_head')
    expect(plan!.directory.path).toContain('instructors')
    expect(plan!.directory.searchParam).toBeNull()
  })

  it('returns null for a role that has no person-directory surface', () => {
    expect(planViewPerson('faculty')).toBeNull()
    expect(planViewPerson('external_client')).toBeNull()
  })
})

describe('assembleViewPerson — resolve person, then fan out to facets', () => {
  const academic = planViewPerson('academic_head')!

  it('resolves by search then fetches id-based facets with the resolved id', async () => {
    const calls: string[] = []
    const getJson = async (path: string, query: Record<string, string>) => {
      calls.push(path)
      if (path.includes('academic-staff')) return { staff: [{ id: 'u1', name: 'Ana Cruz', email: 'ana@x.edu' }] }
      if (path.includes('staff-schedules/u1')) return { schedule: ['MWF 9AM CS101'] }
      if (path.includes('staff-bookings/u1')) return { bookings: [{ reference: 'BK1' }] }
      if (path.includes('reliability')) return { rows: [{ name: 'Ana Cruz', demerits: 2 }] }
      return { error: 'unexpected ' + path }
    }
    const out = await assembleViewPerson(academic, { search: 'cruz' }, getJson)
    expect('error' in out).toBe(false)
    const res = out as unknown as { person: { id: string }; facets: Record<string, unknown> }
    expect(res.person.id).toBe('u1')
    expect(res.facets.schedule).toEqual({ schedule: ['MWF 9AM CS101'] })
    expect(res.facets.bookings).toEqual({ bookings: [{ reference: 'BK1' }] })
    expect(res.facets.reliability).toBeDefined()
    // the id-based facet must have used the RESOLVED id, not the raw search term
    expect(calls.some((c) => c.includes('staff-schedules/u1'))).toBe(true)
  })

  it('returns an error (not a crash) when no person matches the search', async () => {
    const getJson = async () => ({ staff: [] })
    const out = await assembleViewPerson(academic, { search: 'nobody' }, getJson)
    expect('error' in out).toBe(true)
  })

  it('filters client-side when the directory has no search param (instructors)', async () => {
    const programHead = planViewPerson('program_head')!
    const getJson = async () => ({
      instructors: [
        { id: 'i1', full_name: 'Bob Reyes' },
        { id: 'i2', full_name: 'Ana Cruz' },
      ],
    })
    const out = await assembleViewPerson(programHead, { search: 'cruz' }, getJson)
    const res = out as unknown as { person: { id: string }; facets: Record<string, unknown> }
    expect(res.person.id).toBe('i2')
    expect(res.facets).toEqual({})
  })

  it('matches a no-search-param directory by tokens (reordered + middle initial)', async () => {
    const programHead = planViewPerson('program_head')!
    const getJson = async () => ({
      instructors: [
        { id: 'i1', full_name: 'Bob Reyes' },
        { id: 'i2', full_name: 'Ricardo J. Dela Cruz' },
      ],
    })
    // Query omits the middle initial and reorders the surname — still resolves.
    const out = await assembleViewPerson(programHead, { search: 'dela cruz ricardo' }, getJson)
    const res = out as unknown as { person: { id: string } }
    expect(res.person.id).toBe('i2')
  })

  it('prefers an exact name match over the alphabetically-first fuzzy hit', async () => {
    const getJson = async (path: string) => {
      if (path.includes('academic-staff')) {
        // Directory returns both homonyms, name-sorted; the exact match wins.
        return { staff: [{ id: 'u1', name: 'Ana Cruz Santos' }, { id: 'u2', name: 'Ana Cruz' }] }
      }
      return {}
    }
    const out = await assembleViewPerson(academic, { search: 'Ana Cruz' }, getJson)
    const res = out as unknown as { person: { id: string } }
    expect(res.person.id).toBe('u2')
  })

  it('honours an explicit user_id over the first row', async () => {
    const getJson = async (path: string) => {
      if (path.includes('academic-staff')) {
        return { staff: [{ id: 'u1', name: 'First' }, { id: 'u2', name: 'Second' }] }
      }
      return {}
    }
    const out = await assembleViewPerson(academic, { user_id: 'u2' }, getJson)
    const res = out as unknown as { person: { id: string } }
    expect(res.person.id).toBe('u2')
  })
})
