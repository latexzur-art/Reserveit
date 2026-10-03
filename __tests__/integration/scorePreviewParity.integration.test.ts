/**
 * Integration test — Score Preview parity (real DB)
 *
 * Guarantees the chatbot/form pre-submit grade EXACTLY matches what the live
 * booking pipeline produces, by running both against the same context:
 *   previewBookingScore  vs  checkHardConstraints + calculateScore
 *
 * Read-only (no bookings are inserted). Requires real Supabase creds + seeded
 * approval_constraint_rules + at least one active facility. Run with
 * `npm run test:integration`.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetch as undiciFetch } from 'undici'

// Load real credentials — overrides the fake keys from __tests__/setup.ts
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { previewBookingScore, type PreviewUserProfile, type PreviewFields } from '@/backend/booking/scorePreview'
import { checkHardConstraints } from '@/backend/booking/hardConstraintChecker'
import { calculateScore } from '@/backend/booking/softScoringEngine'
import { SCORING_THRESHOLDS, type BookingContext } from '@/backend/booking/booking.types'

const USER_ID = 'f7977a01-5543-44e9-a965-77fe911b52ce' // same anchor user as other integration suites
const PREVIEW_ID = '00000000-0000-0000-0000-000000000000'

function makeSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || key === 'test-service-role-key') {
    throw new Error('Real Supabase credentials not loaded — check .env.local')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: undiciFetch as unknown as typeof globalThis.fetch },
  })
}

let supabase: SupabaseClient
let facilityId: string

// Profile used identically for both the preview and the manual context.
const profile: PreviewUserProfile = {
  id: USER_ID,
  user_type: 'internal',
  account_status: 'active',
  roles: [],
  department: null,
}

// A near-future weekday at a normal mid-day window.
function nextWeekdayISO(daysAhead = 3): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const bookingDate = nextWeekdayISO()

function buildFields(): PreviewFields {
  return {
    facility_id: facilityId,
    booking_date: bookingDate,
    start_time: '10:00',
    end_time: '12:00',
    booking_purpose: 'academic',
    expected_attendees: 20,
    purpose: 'Integration parity test — verifying preview matches the live engine.',
    event_name: null,
    special_requests: null,
    facility_purpose_category: null,
    mismatch_justification: null,
    booking_course_code: null,
    booking_department_code: null,
    session_type: null,
  }
}

// Mirror exactly how scorePreview.ts maps fields+profile → BookingContext.
function buildContext(fields: PreviewFields): BookingContext {
  return {
    booking_id: PREVIEW_ID,
    created_at: new Date().toISOString(),
    user_id: profile.id,
    user_type: 'internal',
    user_roles: [],
    account_status: 'active',
    user_department_id: null,
    user_department_code: null,
    facility_id: fields.facility_id as string,
    booking_date: fields.booking_date as string,
    start_time: fields.start_time as string,
    end_time: fields.end_time as string,
    booking_purpose: 'academic',
    purpose: fields.purpose ?? '',
    event_name: undefined,
    expected_attendees: fields.expected_attendees ?? undefined,
    special_requests: undefined,
    equipment_ids: [],
    self_facilitation_confirmed: false,
    facilitator_name: undefined,
    time_slot_id: undefined,
    facility_purpose_category: null,
    mismatch_justification: null,
    booking_course_code: null,
    booking_department_code: null,
    session_type: null,
  }
}

beforeAll(async () => {
  supabase = makeSupabase()
  const { data, error } = await supabase
    .from('facilities')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()
  if (error || !data) throw new Error('No active facility found to test against')
  facilityId = data.id
})

describe('previewBookingScore parity with the live engine (real DB)', () => {
  it('returns "insufficient" when required fields are missing', async () => {
    const res = await previewBookingScore(supabase, profile, {
      facility_id: null, booking_date: null, start_time: null, end_time: null, booking_purpose: null,
    })
    expect(res.status).toBe('insufficient')
  })

  it('matches checkHardConstraints + calculateScore for a complete booking', async () => {
    const fields = buildFields()
    const context = buildContext(fields)

    const [preview, hard] = await Promise.all([
      previewBookingScore(supabase, profile, fields),
      checkHardConstraints(supabase, context),
    ])

    if (!hard.passed) {
      // Preview must report the same hard failure the pipeline would.
      expect(preview.status).toBe('hard_fail')
      if (preview.status === 'hard_fail') {
        expect(preview.failedCode).toBe(hard.failed_code)
      }
      return
    }

    // Hard constraints pass → preview score must equal the engine's final_score.
    const scoring = await calculateScore(supabase, context)
    expect(preview.status).toBe('scored')
    if (preview.status === 'scored') {
      expect(preview.score).toBe(scoring.final_score)
      expect(preview.willAutoApprove).toBe(scoring.final_score >= SCORING_THRESHOLDS.AUTO_APPROVE)
      expect(preview.autoApproveThreshold).toBe(SCORING_THRESHOLDS.AUTO_APPROVE)
    }
  })
})
