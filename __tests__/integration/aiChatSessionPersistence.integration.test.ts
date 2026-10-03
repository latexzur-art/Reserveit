/**
 * Integration tests — AI Chat Session Persistence (Rita "Past conversations")
 *
 * These tests hit the REAL Supabase database.
 *
 * Regression: the `ai_chat_sessions.user_id` FK originally referenced
 * `auth.users(id)`, but every ReserveIT API route passes the *profile* id
 * (`public.users.id`, what `get_current_user_with_roles` returns as `id` and
 * what the whole app calls `user.id`). A profile id is not an auth.users id, so
 * every `POST /api/ai/sessions` insert failed with FK violation 23503 — a code
 * the route silently swallows (`return { id: null }`). No session ever
 * persisted, so "Past conversations" was always empty and "New chat" had
 * nothing to archive.
 *
 * The fix repoints the FK to `public.users(id)` (matching `bookings.user_id`
 * and every other app table). These tests exercise the real
 * create → archive → recall lifecycle a mocked unit test cannot: a mocked
 * client returns success and never sees the constraint.
 *
 * Test rows are tagged in collected_fields with __test__ for cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetch as undiciFetch } from 'undici'

// Load real credentials — overrides the fake keys set by __tests__/setup.ts
config({ path: resolve(process.cwd(), '.env.local'), override: true })

const MARKER = 'TST_ai_session_fk'

let USER_ID: string

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

async function cleanup(sb: SupabaseClient) {
  await sb.from('ai_chat_sessions').delete().contains('collected_fields', { __test__: MARKER })
}

let supabase: SupabaseClient

beforeAll(async () => {
  supabase = makeSupabase()

  // A real app user is identified by public.users.id (the profile PK), which is
  // exactly the value the sessions API routes insert as user_id. Pick a genuine
  // person (auth_user_id present) so the row mirrors an actual chat user.
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .not('auth_user_id', 'is', null)
    .limit(1)
  const user = users?.[0]
  if (!user) throw new Error('No users with auth_user_id found in DB')
  USER_ID = user.id

  await cleanup(supabase)
})

afterAll(async () => {
  await cleanup(supabase)
})

describe('AI chat session persistence (real DB)', () => {
  it('persists a session keyed by the app profile id (public.users.id)', async () => {
    // Mirrors POST /api/ai/sessions: it inserts user.id (the profile id).
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .insert({
        user_id: USER_ID,
        messages: [{ role: 'user', content: 'book a room tomorrow' }],
        collected_fields: { __test__: MARKER },
        booking_flow: 'standard',
        session_status: 'active',
      })
      .select('id, session_status')
      .single()

    // ← REGRESSION: before the FK repoint this fails with 23503
    //   "violates foreign key constraint ai_chat_sessions_user_id_fkey".
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    expect(data?.session_status).toBe('active')
  })

  it('archived (completed) session is retrievable for past-conversations recall', async () => {
    // create → archive → recall, the exact flow behind "New chat" + History.
    const { data: created, error: createErr } = await supabase
      .from('ai_chat_sessions')
      .insert({
        user_id: USER_ID,
        messages: [{ role: 'user', content: 'reserve the AVR' }],
        collected_fields: { __test__: MARKER },
        session_status: 'active',
      })
      .select('id')
      .single()
    expect(createErr).toBeNull()
    const sessionId = created!.id

    // PATCH /api/ai/sessions/[id] with session_status=completed archives it.
    const { error: archiveErr } = await supabase
      .from('ai_chat_sessions')
      .update({ session_status: 'completed', title: 'Reserve the AVR', summary: 'AVR booking' })
      .eq('id', sessionId)
      .eq('user_id', USER_ID)
    expect(archiveErr).toBeNull()

    // GET /api/ai/sessions/history reads completed rows for this profile id.
    const { data: history, error: histErr } = await supabase
      .from('ai_chat_sessions')
      .select('id, title, session_status')
      .eq('user_id', USER_ID)
      .eq('session_status', 'completed')
    expect(histErr).toBeNull()
    expect(history?.some((s) => s.id === sessionId)).toBe(true)
  })
})
