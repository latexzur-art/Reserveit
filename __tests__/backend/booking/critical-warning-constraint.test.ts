import { describe, it, expect } from 'vitest'
import { checkHardConstraints } from '@/backend/booking/hardConstraintChecker'
import type { BookingContext } from '@/backend/booking/booking.types'

/**
 * Creates a Supabase stub that returns the given `facility_warnings` rows
 * when the critical-warning query fires, plus empty results for all other
 * hard-constraint queries so they pass.
 */
function stubWithWarnings(warnings: { message: string; severity: string }[] = []) {
  // Track which table is being queried so we can return the right data
  function makeBuilder(tableName: string) {
    const builder: any = {
      _tableName: tableName,
      select: () => builder,
      eq: () => builder,
      lte: () => builder,
      gte: () => builder,
      in: () => builder,
      neq: () => builder,
      single: () => {
        // Return minimal passing data for each table
        if (tableName === 'users') return Promise.resolve({ data: { account_status: 'active' }, error: null })
        if (tableName === 'facilities') return Promise.resolve({ data: { status: 'available', capacity: 100, advance_booking_days: 14, buffer_time: null, is_available_for_rental: false, min_booking_duration: '00:30:00', max_booking_duration: '12:00:00', always_requires_approval: false }, error: null })
        if (tableName === 'academic_terms') return Promise.resolve({ data: null, error: null })
        if (tableName === 'system_settings') return Promise.resolve({ data: { value: 0 }, error: null })
        return Promise.resolve({ data: null, error: null })
      },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      limit: () => {
        if (tableName === 'facility_warnings') {
          return Promise.resolve({ data: warnings.length > 0 ? warnings : null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      },
      order: () => Promise.resolve({ data: [], error: null }),
      then: (resolve: (v: unknown) => void) => {
        // Default resolution for queries that don't chain .single()/.limit()
        if (tableName === 'facility_warnings') {
          resolve({ data: warnings.length > 0 ? warnings : null, error: null })
        } else {
          resolve({ data: [], error: null })
        }
      },
    }
    return builder
  }

  // Mock the hard rules load (from approval_constraint_rules)
  const hardRules = [
    { code: 'FACILITY_CRITICAL_WARNING', applies_to: 'both', is_reroutable: false, rejection_message: 'Facility has a critical warning.' },
  ]

  const rulesBuilder: any = {
    select: () => rulesBuilder,
    eq: () => rulesBuilder,
    order: () => Promise.resolve({ data: hardRules, error: null }),
  }

  const supabase = {
    from: (tableName: string) => {
      if (tableName === 'approval_constraint_rules') return rulesBuilder
      return makeBuilder(tableName)
    },
  }

  return supabase as any
}

const base: BookingContext = {
  booking_id: 'b1',
  facility_id: 'f1',
  user_id: 'u1',
  user_type: 'internal',
  user_roles: [],
  account_status: 'active',
  user_department_id: null,
  user_department_code: null,
  booking_date: '2026-08-14',
  start_time: '10:00',
  end_time: '12:00',
  purpose: 'Class',
  booking_purpose: 'academic',
  created_at: '2026-08-01T00:00:00Z',
} as BookingContext

describe('FACILITY_CRITICAL_WARNING hard constraint', () => {
  it('blocks booking when facility has an active critical warning', async () => {
    const supabase = stubWithWarnings([
      { message: 'Electrical hazard detected in room', severity: 'critical' },
    ])

    const result = await checkHardConstraints(supabase, base)

    expect(result.passed).toBe(false)
    expect(result.failed_code).toBe('FACILITY_CRITICAL_WARNING')
    expect(result.message).toContain('Electrical hazard detected in room')
    expect(result.message).toContain('contact the building admin')
  })

  it('allows booking when facility has only info-severity warnings', async () => {
    const supabase = stubWithWarnings([])

    const result = await checkHardConstraints(supabase, base)

    expect(result.passed).toBe(true)
  })

  it('allows booking when facility has no warnings at all', async () => {
    const supabase = stubWithWarnings([])

    const result = await checkHardConstraints(supabase, base)

    expect(result.passed).toBe(true)
  })
})
