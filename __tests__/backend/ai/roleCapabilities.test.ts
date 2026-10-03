import { describe, it, expect } from 'vitest'
import {
  resolveCapabilities,
  applyKillSwitches,
  isActorBlocked,
  ROLE_CAPABILITIES,
  type AssistantToolName,
} from '@/backend/ai/roleCapabilities'

describe('resolveCapabilities', () => {
  it('falls back to the external-client (booking-only) surface for empty/unknown roles', () => {
    expect(resolveCapabilities([]).role).toBe('external_client')
    expect(resolveCapabilities(null).role).toBe('external_client')
    expect(resolveCapabilities([{ name: 'nonsense_role' }]).role).toBe('external_client')

    const caps = resolveCapabilities([])
    expect(caps.canBook).toBe(true)
    expect(caps.actions).toContain('cancel_my_booking')
    // booking-only surface: no admin/staff actions leak in
    expect(caps.actions).not.toContain('set_user_status')
    expect(caps.actions).not.toContain('approve_booking')
  })

  it('maps a single role to its own capability', () => {
    const caps = resolveCapabilities([{ name: 'it_admin' }])
    expect(caps.role).toBe('it_admin')
    expect(caps.label).toBe('IT Admin')
    expect(caps.canBook).toBe(false)
    expect(caps.defaultFormRoute).toBeNull()
    expect(caps.tools).toContain('search_users')
    expect(caps.actions).toContain('set_user_status')
  })

  it('accepts string[] role lists as well as {name}[]', () => {
    const a = resolveCapabilities(['academic_head'])
    const b = resolveCapabilities([{ name: 'academic_head' }])
    expect(a.tools.sort()).toEqual(b.tools.sort())
    expect(a.actions.sort()).toEqual(b.actions.sort())
  })

  it('keeps the highest-priority role identity but UNIONs tools/actions across roles', () => {
    // it_admin outranks faculty in ROLE_PRIORITY → primary identity is it_admin.
    const caps = resolveCapabilities([{ name: 'faculty' }, { name: 'it_admin' }])
    expect(caps.role).toBe('it_admin')

    // Union of tools: faculty booking tools + it_admin lookups.
    const expectFacultyTools: AssistantToolName[] = ['search_availability', 'suggest_room', 'score_booking']
    for (const t of expectFacultyTools) expect(caps.tools).toContain(t)
    expect(caps.tools).toContain('search_users')

    // Union of actions: faculty cancel + it_admin admin actions.
    expect(caps.actions).toContain('cancel_my_booking')
    expect(caps.actions).toContain('set_user_status')

    // canBook true because faculty can book; defaultFormRoute resolves to a booking route.
    expect(caps.canBook).toBe(true)
    expect(caps.defaultFormRoute).toBe('/faculty/form')
  })

  it('dedupes tools, actions, and destinations in the union', () => {
    const caps = resolveCapabilities([{ name: 'faculty' }, { name: 'academic_head' }])
    expect(new Set(caps.tools).size).toBe(caps.tools.length)
    expect(new Set(caps.actions).size).toBe(caps.actions.length)
    expect(new Set(caps.destinations.map((d) => d.href)).size).toBe(caps.destinations.length)
  })

  it('serves the PAMO officer with equipment lookups and no booking/admin write leakage', () => {
    const caps = resolveCapabilities([{ name: 'pamo_officer' }])
    expect(caps.role).toBe('pamo_officer')
    expect(caps.label).toBe('PAMO Officer')
    expect(caps.canBook).toBe(false)
    expect(caps.defaultFormRoute).toBeNull()
    expect(caps.tools).toContain('get_pamo_equipment')
    expect(caps.tools).toContain('get_pamo_attention')
    // read-only surface: no booking tools and no write-actions leak in
    expect(caps.tools).not.toContain('search_availability')
    expect(caps.actions).toEqual([])
  })

  it('every registered role exposes a coherent surface', () => {
    for (const [name, cap] of Object.entries(ROLE_CAPABILITIES)) {
      expect(cap.role).toBe(name)
      expect(cap.label.length).toBeGreaterThan(0)
      expect(cap.persona.length).toBeGreaterThan(0)
      expect(cap.destinations.length).toBeGreaterThan(0)
      expect(cap.quickActions.length).toBeGreaterThan(0)
      if (cap.canBook) expect(cap.defaultFormRoute).toBeTruthy()
    }
  })
})

describe('view_person tool exposure', () => {
  it('is exposed to the four admin/head roles and withheld from booking-only + PAMO roles', () => {
    for (const r of ['academic_head', 'building_admin', 'it_admin', 'program_head']) {
      expect(resolveCapabilities([{ name: r }]).tools).toContain('view_person')
    }
    expect(resolveCapabilities([{ name: 'faculty' }]).tools).not.toContain('view_person')
    expect(resolveCapabilities([{ name: 'external_client' }]).tools).not.toContain('view_person')
    expect(resolveCapabilities([{ name: 'pamo_officer' }]).tools).not.toContain('view_person')
  })
})

describe('tool-backed destinations per role', () => {
  it('USER_MANAGER has destinations for tech equipment tools', () => {
    const caps = resolveCapabilities([{ name: 'it_admin' }])
    const destIds = caps.destinations.map(d => d.id)
    expect(destIds).toContain('equipment')
    expect(destIds).toContain('equipment_reports')
    expect(destIds).toContain('equipment_requests')
  })

  it('ACADEMIC_HEAD has destinations for schedule management tools', () => {
    const caps = resolveCapabilities([{ name: 'academic_head' }])
    const destIds = caps.destinations.map(d => d.id)
    expect(destIds).toContain('schedule_reviews')
    expect(destIds).toContain('assignments')
    expect(destIds).toContain('sections')
  })

  it('PROGRAM_HEAD has destinations for schedule management tools', () => {
    const caps = resolveCapabilities([{ name: 'program_head' }])
    const destIds = caps.destinations.map(d => d.id)
    expect(destIds).toContain('assignments')
    expect(destIds).toContain('sections')
  })

  it('BUILDING_ADMIN has destinations for HVAC tools', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    const destIds = caps.destinations.map(d => d.id)
    expect(destIds).toContain('equipment_hvac')
    expect(destIds).toContain('equipment_reports')
    expect(destIds).toContain('equipment_requests')
  })
})

describe('isActorBlocked', () => {
  it('blocks restricted, suspended and inactive accounts (case-insensitive)', () => {
    expect(isActorBlocked('restricted')).toBe(true)
    expect(isActorBlocked('suspended')).toBe(true)
    expect(isActorBlocked('inactive')).toBe(true)
    expect(isActorBlocked('RESTRICTED')).toBe(true)
  })

  it('allows active and probation accounts, and treats missing status as not blocked', () => {
    expect(isActorBlocked('active')).toBe(false)
    expect(isActorBlocked('probation')).toBe(false)
    expect(isActorBlocked(null)).toBe(false)
    expect(isActorBlocked(undefined)).toBe(false)
  })
})

describe('applyKillSwitches', () => {
  const caps = resolveCapabilities([{ name: 'it_admin' }])

  it('returns the capability unchanged when no kill-switch env is set', () => {
    const out = applyKillSwitches(caps, {})
    expect(out.tools).toEqual(caps.tools)
    expect(out.actions).toEqual(caps.actions)
  })

  it('neuters the agent for a killed role — no tools or actions leak through', () => {
    const out = applyKillSwitches(caps, { AI_KILL_ROLES: 'it_admin' })
    expect(out.tools).toEqual([])
    expect(out.actions).toEqual([])
    // booking-form capability itself is untouched — only the agent surface is cut
    expect(out.canBook).toBe(caps.canBook)
  })

  it('removes only the named action(s) for a killed action, leaving tools intact', () => {
    const out = applyKillSwitches(caps, { AI_KILL_ACTIONS: 'set_user_status, set_active_term' })
    expect(out.actions).not.toContain('set_user_status')
    expect(out.actions).not.toContain('set_active_term')
    expect(out.actions).toContain('assign_role')
    expect(out.tools).toEqual(caps.tools)
  })
})

describe('RITA payment/cancellation tool-list membership (regression pins)', () => {
  it('exposes get_my_payments to Client, Faculty, Program Head, and Academic Head', () => {
    for (const r of ['external_client', 'faculty', 'program_head', 'academic_head']) {
      expect(resolveCapabilities([{ name: r }]).tools).toContain('get_my_payments')
    }
  })

  it('exposes get_my_cancellation_requests to Client, Faculty, Program Head, and Academic Head', () => {
    for (const r of ['external_client', 'faculty', 'program_head', 'academic_head']) {
      expect(resolveCapabilities([{ name: r }]).tools).toContain('get_my_cancellation_requests')
    }
  })

  it('exposes get_refund_ledger and get_qr_codes to Building Admin', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    expect(caps.tools).toContain('get_refund_ledger')
    expect(caps.tools).toContain('get_qr_codes')
  })

  it('exposes get_cancellation_requests to Academic Head', () => {
    expect(resolveCapabilities([{ name: 'academic_head' }]).tools).toContain('get_cancellation_requests')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// School Events + Exam Period Block: read-only viewer tool for the five
// roles with no privileged school-events tool (deliberately a different
// name/tool from Program Head's own-submissions-only get_school_events).
// ═══════════════════════════════════════════════════════════════════════

describe('get_upcoming_school_events — read-only viewer tool', () => {
  const VIEWER_ROLES = ['external_client', 'faculty', 'program_head', 'it_admin', 'pamo_officer']

  it.each(VIEWER_ROLES)('%s has get_upcoming_school_events in tools', (role) => {
    expect(resolveCapabilities([{ name: role }]).tools).toContain('get_upcoming_school_events')
  })

  it('academic_head and building_admin do NOT have it (they use the richer privileged tool)', () => {
    expect(resolveCapabilities([{ name: 'academic_head' }]).tools).not.toContain('get_upcoming_school_events')
    expect(resolveCapabilities([{ name: 'building_admin' }]).tools).not.toContain('get_upcoming_school_events')
  })

  it('program_head keeps its existing get_school_events tool too (additive, not a replacement)', () => {
    expect(resolveCapabilities([{ name: 'program_head' }]).tools).toContain('get_school_events')
  })

  it.each(VIEWER_ROLES)('%s gained no new actions from this feature (read-only stays read-only)', (role) => {
    const actions = resolveCapabilities([{ name: role }]).actions
    for (const forbidden of [
      'create_school_event', 'cancel_school_event',
      'approve_school_event_request', 'reject_school_event_request',
      'confirm_school_event_cancellation', 'decline_school_event_cancellation',
      'withdraw_school_event_request',
    ]) {
      expect(actions).not.toContain(forbidden)
    }
  })
})
