/**
 * Integration tests — Course Upload Flow
 *
 * These tests hit the REAL Supabase database.
 * They cover the three gaps that mocked unit tests cannot:
 *
 *   Gap 1 — parseCSVContent: real parser on real CSV strings (no DB needed, but
 *            verified here end-to-end alongside the rest of the flow)
 *   Gap 2 — Approval flow: upload → validate → commit → submit → approve
 *            and verify approval_status = 'approved' lands in the DB
 *   Gap 3 — Course unblocks schedule: after approval the schedule entry validator
 *            resolves the course without COURSE_PENDING_APPROVAL / COURSE_NOT_IN_CATALOG
 *            warnings, and correctly sets session_type from delivery_mode
 *
 * Anchors (confirmed in DB before writing this):
 *   department  BSIT  id=425dd5a0-7a2a-4b34-b41e-4c70ae168bda
 *   term        FA2026 id=3b15e132-6c41-4ea9-8f4f-d6f96c4bdb7c
 *   user        id=f7977a01-5543-44e9-a965-77fe911b52ce
 *
 * All test data uses TST_ prefix for easy identification and cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetch as undiciFetch } from 'undici'

// Load real credentials — overrides the fake keys set by __tests__/setup.ts
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import {
  createUploadBatch,
  parseCSVContent,
  validateAndPreviewBatch,
  commitBatch,
  submitBatch,
} from '@/backend/course/courseUpload.service'
import { approveBatch } from '@/backend/course/courseApproval.service'
import { validateAndEnrichEntry } from '@/backend/schedule/entryValidator'
import type { RawCsvRow } from '@/backend/schedule/schedule.types'

// ─── constants ────────────────────────────────────────────────────────────────

let DEPT_ID: string
let DEPT_CODE: string
let TERM_ID: string
let USER_ID: string

const TEST_CODES = ['TSTU1001', 'TSTU1002', 'TSTU1003']

function getValidCsv() {
  return `department_code,course_code,course_name,units,year_level,term,delivery_mode,lecture_hours,lab_hours,prerequisite_codes,is_elective,description
${DEPT_CODE},TSTU1001,Test Subject Lecture,3,1,1,lecture,3.0,,,false,Integration test
${DEPT_CODE},TSTU1002,Test Subject Lab,2,1,1,lab,,3.0,,false,Integration test
${DEPT_CODE},TSTU1003,Test Subject Both,4,2,1,both,2.0,2.0,,false,Integration test`
}

// ─── Supabase admin client ────────────────────────────────────────────────────

function makeSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || key === 'test-service-role-key') {
    throw new Error('Real Supabase credentials not loaded — check .env.local')
  }
  // Pass undici fetch explicitly so setup.ts's vi.fn() global mock is bypassed.
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: undiciFetch as unknown as typeof globalThis.fetch },
  })
}

// ─── cleanup helper ───────────────────────────────────────────────────────────

async function cleanup(sb: SupabaseClient) {
  await sb.from('courses').delete()
    .eq('department_code', DEPT_CODE)
    .in('course_code', [...TEST_CODES, 'TSTU8888'])
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

let supabase: SupabaseClient

beforeAll(async () => {
  supabase = makeSupabase()

  // Fetch valid IDs to avoid foreign key constraint errors
  const { data: depts } = await supabase.from('departments').select('id, code').limit(1)
  const dept = depts?.[0]
  if (!dept) throw new Error('No departments found in DB')
  DEPT_ID = dept.id
  DEPT_CODE = dept.code

  const { data: terms } = await supabase.from('academic_terms').select('id').limit(1)
  const term = terms?.[0]
  if (!term) throw new Error('No terms found in DB')
  TERM_ID = term.id

  const { data: users } = await supabase.from('users').select('id').limit(1)
  const user = users?.[0]
  if (!user) throw new Error('No users found in DB')
  USER_ID = user.id

  await cleanup(supabase)
})

afterAll(async () => {
  await cleanup(supabase)
})

// ─── Gap 1+2: Full upload → approve flow ─────────────────────────────────────

describe('Gap 2 — Full upload → approve flow (real DB)', () => {
  let batchId: string

  it('parseCSVContent parses all rows without errors', async () => {
    const { rows } = await parseCSVContent(getValidCsv())
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.errors).toHaveLength(0)
      expect(row.input).not.toBeNull()
    }
  })

  it('createUploadBatch inserts a draft record in the DB', async () => {
    const batch = await createUploadBatch(supabase, DEPT_ID, TERM_ID, 'file_upload', USER_ID)
    expect(batch.id).toBeTruthy()
    expect(batch.upload_status).toBe('draft')
    batchId = batch.id
  })

  it('validateAndPreviewBatch returns no errors for valid courses', async () => {
    const { rows } = await parseCSVContent(getValidCsv())
    const validInputs = rows.map(r => r.input!)

    const preview = await validateAndPreviewBatch(supabase, batchId, validInputs)
    expect(preview.hasErrors).toBe(false)
    expect(preview.validRows).toHaveLength(3)
  })

  it('commitBatch writes courses to DB', async () => {
    const { rows } = await parseCSVContent(getValidCsv())
    const { coursesCreated } = await commitBatch(supabase, batchId, rows.map(r => r.input!), USER_ID)
    expect(coursesCreated).toBe(3)

    const { data } = await supabase
      .from('courses')
      .select('course_code, approval_status')
      .eq('department_code', DEPT_CODE)
      .in('course_code', TEST_CODES)

    expect(data).toHaveLength(3)
  })

  it('submitBatch transitions batch → submitted and courses → pending', async () => {
    await submitBatch(supabase, batchId, USER_ID)

    const { data: batch } = await supabase
      .from('course_uploads').select('upload_status').eq('id', batchId).single()
    expect(batch?.upload_status).toBe('submitted')

    const { data: courses } = await supabase
      .from('courses').select('approval_status')
      .in('course_code', TEST_CODES).eq('department_code', DEPT_CODE)
    for (const c of courses!) expect(c.approval_status).toBe('pending')
  })

  it('approveBatch sets approval_status = approved in the DB', async () => {
    await approveBatch(supabase, batchId, USER_ID)

    const { data: courses } = await supabase
      .from('courses').select('course_code, approval_status, delivery_mode')
      .in('course_code', TEST_CODES).eq('department_code', DEPT_CODE)

    expect(courses).toHaveLength(3)
    for (const c of courses!) {
      // ← GAP 2: the mocked tests stubbed approveBatch — this verifies it actually writes
      expect(c.approval_status).toBe('approved')
    }

    const { data: batch } = await supabase
      .from('course_uploads').select('upload_status').eq('id', batchId).single()
    expect(batch?.upload_status).toBe('approved')
  })
})

// ─── Gap 3: Approved course unblocks schedule validation ─────────────────────

describe('Gap 3 — Schedule validator sees approved courses (real DB)', () => {
  function rawRow(courseCode: string, overrides: Partial<RawCsvRow> = {}): RawCsvRow {
    return {
      row_number: 1,
      course_code: courseCode,
      section: 'A',
      facility_name: '',    // empty — facility resolution is a separate concern
      instructor_name: '',
      day_of_week_raw: 'Monday',
      start_time_raw: '08:00',
      end_time_raw: '10:00',
      ...overrides,
    }
  }

  it('approved course → no COURSE_NOT_IN_CATALOG warning', async () => {
    // TSTU1001 was approved by the Gap 2 tests above
    const result = await validateAndEnrichEntry(supabase, rawRow('TSTU1001'))
    const catalogWarnings = (result.validation_warnings ?? []).filter(
      w => w.code === 'COURSE_NOT_IN_CATALOG' || w.code === 'COURSE_PENDING_APPROVAL'
    )
    // ← GAP 3: approved course clears the catalog warnings entirely
    expect(catalogWarnings).toHaveLength(0)
  })

  it('approved lecture course → session_type resolved to lecture', async () => {
    const result = await validateAndEnrichEntry(supabase, rawRow('TSTU1001'))
    // delivery_mode=lecture → session_type should be set
    expect(result.session_type).toBe('lecture')
  })

  it('approved lab course → session_type resolved to lab', async () => {
    const result = await validateAndEnrichEntry(supabase, rawRow('TSTU1002'))
    expect(result.session_type).toBe('lab')
  })

  it('pending (unapproved) course → COURSE_PENDING_APPROVAL warning', async () => {
    // Insert a course directly as pending to test the status gate.
    // uploaded_by is required (NOT NULL) — include it to avoid a silent insert failure.
    const { error: insertErr } = await supabase.from('courses').insert({
      department_code: DEPT_CODE,
      course_code: 'TSTU8888',
      course_name: 'Pending Course',
      units: 3,
      year_level: 1,
      term: 1,
      delivery_mode: 'lecture',
      lecture_hours: 3,
      approval_status: 'pending',
      is_elective: false,
      created_by: USER_ID,
    })
    if (insertErr) throw new Error(`Seed insert failed: ${insertErr.message}`)

    const result = await validateAndEnrichEntry(supabase, rawRow('TSTU8888'))
    const pendingWarning = (result.validation_warnings ?? []).find(w => w.code === 'COURSE_PENDING_APPROVAL')
    expect(pendingWarning).toBeDefined()
  })

  it('unknown course_code → COURSE_NOT_IN_CATALOG warning/error', async () => {
    const result = await validateAndEnrichEntry(supabase, rawRow('TSTU9999'))
    const missing = (result.validation_errors ?? []).find(e => e.code === 'COURSE_NOT_IN_CATALOG') ||
                    (result.validation_warnings ?? []).find(w => w.code === 'COURSE_NOT_IN_CATALOG')
    expect(missing).toBeDefined()
  })
})
