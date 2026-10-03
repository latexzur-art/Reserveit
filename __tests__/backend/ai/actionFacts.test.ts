import { describe, it, expect } from 'vitest'
import { resolveActionFacts, getActionMeta, getActionTier } from '@/backend/ai/actions'

function fakeFetch(payload: unknown, ok = true, status = 200) {
  return async () => ({
    ok,
    status,
    json: async () => payload,
  })
}

const bookingPayload = {
  booking: {
    id: 'b-uuid',
    booking_reference: 'BK-REAL',
    current_status: 'pending',
    booking_date: '2026-08-10',
    start_time: '09:00',
    end_time: '11:00',
    booking_facilities: [{ facility: { name: 'Room A' } }],
  },
}

describe('resolveActionFacts — server truth for the confirm card (HIGH #1)', () => {
  it('re-fetches the booking and reports SERVER facts, ignoring the model-supplied reference', async () => {
    const facts = await resolveActionFacts(
      'approve_booking',
      { booking_id: 'b-uuid', booking_reference: 'BK-FAKE' },
      { cookie: null, origin: 'http://x', fetchImpl: fakeFetch(bookingPayload) }
    )
    expect(facts).not.toBeNull()
    const flat = JSON.stringify(facts)
    expect(flat).toContain('BK-REAL') // authoritative reference from the server
    expect(flat).not.toContain('BK-FAKE') // model's guess is discarded
    expect(facts).toContainEqual({ label: 'Status', value: 'pending' })
    expect(flat).toContain('Room A')
  })

  it('falls back to params (still structured, not prose) when the fetch fails', async () => {
    const facts = await resolveActionFacts(
      'approve_booking',
      { booking_id: 'b-uuid', booking_reference: 'BK-FALLBACK' },
      { cookie: null, origin: 'http://x', fetchImpl: fakeFetch({ error: 'nope' }, false, 404) }
    )
    expect(facts).not.toBeNull()
    expect(JSON.stringify(facts)).toContain('BK-FALLBACK')
  })

  it('derives facts from params for a non-booking action without any fetch', async () => {
    const facts = await resolveActionFacts(
      'set_user_status',
      { user_id: 'u1', user_name: 'Jane Doe', status: 'suspended' },
      { cookie: null, origin: 'http://x' }
    )
    expect(facts).not.toBeNull()
    const flat = JSON.stringify(facts)
    expect(flat).toContain('Jane Doe')
    expect(flat).toContain('suspended')
  })
})

describe('four-rung tier ladder + blast-radius escalation', () => {
  it('maps a standard write to the confirm tier and a high-risk write to the type tier', () => {
    expect(getActionTier('assign_role')).toBe('confirm')
    expect(getActionTier('publish_schedule_upload')).toBe('type')
  })

  it('auto-escalates a wide-blast-radius action to high risk / type tier', () => {
    const many = { user_ids: [1, 2, 3, 4, 5, 6, 7] }
    expect(getActionMeta('assign_role').risk).toBe('normal')
    expect(getActionMeta('assign_role', many).risk).toBe('high')
    expect(getActionTier('assign_role', many)).toBe('type')
  })
})

describe('resolveActionFacts — create_school_event resolves real facility/date counts', () => {
  it('all_facilities: true resolves the REAL live facility count from the server, not a model claim', async () => {
    const facilitiesPayload = { facilities: Array.from({ length: 50 }, (_, i) => ({ id: `f${i}` })) }
    const facts = await resolveActionFacts(
      'create_school_event',
      { event_name: 'Finals Week', mode: 'exam_period', all_facilities: true, dates: ['2026-10-01', '2026-10-02'], model_claimed_facility_count: 12 },
      { cookie: null, origin: 'http://x', fetchImpl: fakeFetch(facilitiesPayload) }
    )
    expect(facts).not.toBeNull()
    const flat = JSON.stringify(facts)
    expect(flat).toContain('All 50 active facilities')
    expect(flat).not.toContain('12')
    expect(facts).toContainEqual({ label: 'Days', value: '2' })
  })

  it('an explicit facility_ids array reports its real length', async () => {
    const facts = await resolveActionFacts(
      'create_school_event',
      { event_name: 'Founders Day', mode: 'school_event', facility_ids: ['f1', 'f2', 'f3'], start_date: '2026-09-01' },
      { cookie: null, origin: 'http://x' }
    )
    expect(facts).toContainEqual({ label: 'Facilities', value: '3' })
    expect(facts).toContainEqual({ label: 'Days', value: '1' })
  })

  it('a start_date/end_date range reports the real computed day count', async () => {
    const facts = await resolveActionFacts(
      'create_school_event',
      { event_name: 'Founders Week', mode: 'school_event', facility_id: 'f1', start_date: '2026-09-01', end_date: '2026-09-03' },
      { cookie: null, origin: 'http://x' }
    )
    expect(facts).toContainEqual({ label: 'Days', value: '3' })
    expect(facts).toContainEqual({ label: 'Facilities', value: '1' })
  })
})
