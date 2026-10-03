import { describe, it, expect } from 'vitest'
import { onCourseApproved } from '@/backend/course/courseApproval.service'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Regression coverage for course-approval auto-activation: approving a course
 * must clear COURSE_NOT_IN_CATALOG (an *error*) and COURSE_PENDING_APPROVAL
 * (a *warning*) from staged schedule entries — and must NOT mark an entry
 * valid while unrelated errors remain.
 */

interface Update { table: string; values: Record<string, unknown>; ids: string[] }

function mockSupabase(stagingEntries: unknown[], updates: Update[]): SupabaseClient {
  function builder(table: string) {
    const b: Record<string, unknown> = {}
    let pendingUpdate: Record<string, unknown> | null = null
    const ids: string[] = []
    const chain = () => b
    b.select = chain
    b.eq = (col: string, val: unknown) => {
      if (pendingUpdate && col === 'id') ids.push(String(val))
      return b
    }
    b.in = (col: string, vals: unknown) => {
      if (pendingUpdate && col === 'id') ids.push(...(vals as string[]))
      return b
    }
    b.update = (values: Record<string, unknown>) => {
      pendingUpdate = values
      return b
    }
    b.single = () => Promise.resolve({ data: { course_code: 'CS101', department_code: 'IT' }, error: null })
    b.then = (resolve: (v: unknown) => unknown) => {
      if (pendingUpdate) {
        updates.push({ table, values: pendingUpdate, ids: [...ids] })
        return Promise.resolve({ data: null, error: null }).then(resolve)
      }
      return Promise.resolve({ data: stagingEntries, error: null }).then(resolve)
    }
    return b
  }
  return { from: (t: string) => builder(t) } as unknown as SupabaseClient
}

describe('onCourseApproved', () => {
  it('clears catalog errors/warnings and recomputes status per entry', async () => {
    const updates: Update[] = []
    const supabase = mockSupabase(
      [
        { // only blocked by the catalog error → becomes valid
          id: 'e1',
          validation_errors: [{ code: 'COURSE_NOT_IN_CATALOG' }],
          validation_warnings: [],
        },
        { // catalog warning + unrelated warning → stays warning
          id: 'e2',
          validation_errors: [],
          validation_warnings: [{ code: 'COURSE_PENDING_APPROVAL' }, { code: 'UNUSUAL_HOURS' }],
        },
        { // catalog error + unrelated error → must STAY error (regression)
          id: 'e3',
          validation_errors: [{ code: 'COURSE_NOT_IN_CATALOG' }, { code: 'MISSING_SECTION' }],
          validation_warnings: [],
        },
      ],
      updates,
    )

    await onCourseApproved(supabase, 'course-1')

    const validUpdate = updates.find(u => u.ids.includes('e1'))
    expect(validUpdate?.values.validation_status).toBe('valid')
    expect(validUpdate?.values.validation_errors).toEqual([])

    const warnUpdate = updates.find(u => u.ids.includes('e2'))
    expect(warnUpdate?.values.validation_status).toBe('warning')
    expect((warnUpdate?.values.validation_warnings as any[]).map(w => w.code)).toEqual(['UNUSUAL_HOURS'])

    const errUpdate = updates.find(u => u.ids.includes('e3'))
    expect(errUpdate?.values.validation_status).toBe('error')
    expect((errUpdate?.values.validation_errors as any[]).map(e => e.code)).toEqual(['MISSING_SECTION'])
  })
})
