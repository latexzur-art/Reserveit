import { describe, it, expect } from 'vitest'
import { resolveCapabilities } from '@/backend/ai/roleCapabilities'
import { LOOKUP_ENDPOINTS, TOOL_DEFINITIONS, LOOKUP_TOOL_DEFINITIONS } from '@/backend/ai/tools/definitions'
import { getActionTier, ACTIONS } from '@/backend/ai/actions'
import { buildStableSystemPrompt } from '@/app/api/ai/chat/_lib/prompt'

const ALL_TOOLS = [...TOOL_DEFINITIONS, ...LOOKUP_TOOL_DEFINITIONS]
const ah = () => resolveCapabilities([{ name: 'academic_head' }])

// ═══════════════════════════════════════════════
// Original tests (preserved)
// ═══════════════════════════════════════════════

describe('Academic Head read tools', () => {
  it('reuses the shared schedule reads and adds departments / change-requests / special-events', () => {
    const t = ah().tools
    for (const name of [
      'get_professor_assignments', 'get_approved_schedules', 'get_sections', 'get_curriculum_pending',
      'get_departments', 'get_change_requests', 'get_special_events',
    ]) {
      expect(t).toContain(name)
    }
  })

  it('maps the new reads to real proxied endpoints', () => {
    for (const name of ['get_departments', 'get_change_requests', 'get_special_events'] as const) {
      expect(LOOKUP_ENDPOINTS[name]?.path).toMatch(/^\/api\//)
    }
  })
})

describe('Academic Head write actions', () => {
  it('exposes curriculum approval-queue + change-request + batch-approve actions', () => {
    const a = ah().actions
    for (const name of [
      'approve_curriculum_batch', 'reject_curriculum_batch', 'send_back_curriculum_batch',
      'decide_change_request', 'batch_approve_reviews',
    ]) {
      expect(a).toContain(name)
    }
  })

  it('proxies each approval action to the right endpoint + method', () => {
    expect(ACTIONS.approve_curriculum_batch.request({ batch_id: 'B1' })).toMatchObject({
      method: 'POST', path: '/api/courses/approval/batch/B1/approve',
    })
    expect(ACTIONS.reject_curriculum_batch.request({ batch_id: 'B1', reason: 'dup' })).toMatchObject({
      method: 'POST', path: '/api/courses/approval/batch/B1/reject',
    })
    expect(ACTIONS.decide_change_request.request({ request_id: 'R1', decision: 'approve' })).toMatchObject({
      method: 'POST', path: '/api/schedules/change-requests/review/R1',
    })
  })

  it('auto-escalates a large batch-approve to type-to-confirm', () => {
    const many = { booking_ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }
    expect(getActionTier('batch_approve_reviews', many)).toBe('type')
  })
})

// ═══════════════════════════════════════════════
// Phase 1: New read tools
// ═══════════════════════════════════════════════

describe('Academic Head new read tools', () => {
  it('exposes get_all_bookings for all reservations', () => {
    expect(ah().tools).toContain('get_all_bookings')
  })

  it('exposes get_faculty_availability', () => {
    expect(ah().tools).toContain('get_faculty_availability')
  })

  it('exposes get_assignment_lineups', () => {
    expect(ah().tools).toContain('get_assignment_lineups')
  })

  it('exposes get_schedule_history', () => {
    expect(ah().tools).toContain('get_schedule_history')
  })

  it('exposes get_schedule_exceptions', () => {
    expect(ah().tools).toContain('get_schedule_exceptions')
  })

  it('maps get_all_bookings to academic-head reservations endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_all_bookings!
    expect(ep.path).toBe('/api/academic-head/reservations')
  })

  it('maps get_faculty_availability to faculty availability endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_faculty_availability!
    expect(ep.path).toBe('/api/faculty/availability')
  })

  it('maps get_assignment_lineups to schedules assignments endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_assignment_lineups!
    expect(ep.path).toBe('/api/schedules/assignments')
  })

  it('get_all_bookings has search, status, department params', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_all_bookings')!
    expect(tool).toBeDefined()
    const props = tool.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('search')
    expect(props).toHaveProperty('status')
    expect(props).toHaveProperty('department')
  })

  it('get_faculty_availability has department_id param', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_faculty_availability')!
    expect(tool).toBeDefined()
    const props = tool.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('department_id')
  })

  it('get_assignment_lineups has status and department_id params', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_assignment_lineups')!
    expect(tool).toBeDefined()
    const props = tool.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('status')
    expect(props).toHaveProperty('department_id')
  })

  it('get_approved_schedules has unassigned param', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_approved_schedules')!
    expect(tool).toBeDefined()
    const props = tool.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('unassigned')
  })

  it('get_approved_schedules LOOKUP_ENDPOINTS includes unassigned', () => {
    const ep = LOOKUP_ENDPOINTS.get_approved_schedules!
    expect(ep.params).toContain('unassigned')
  })
})

// ═══════════════════════════════════════════════
// Phase 2: New write actions
// ═══════════════════════════════════════════════

describe('Academic Head new write actions', () => {
  it('exposes schedule approval actions', () => {
    const a = ah().actions
    expect(a).toContain('approve_schedule_upload')
    expect(a).toContain('reject_schedule_upload')
  })

  it('exposes school event actions', () => {
    const a = ah().actions
    expect(a).toContain('create_school_event')
    expect(a).toContain('cancel_school_event')
  })

  it('exposes academic term actions', () => {
    const a = ah().actions
    expect(a).toContain('create_academic_term')
  })

  it('exposes booking management actions', () => {
    const a = ah().actions
    expect(a).toContain('delete_booking')
  })

  it('exposes professor assignment actions', () => {
    const a = ah().actions
    expect(a).toContain('assign_professor')
    expect(a).toContain('unassign_professor')
    expect(a).toContain('approve_assignment_lineup')
    expect(a).toContain('reject_assignment_lineup')
  })

  it('exposes schedule CRUD actions', () => {
    const a = ah().actions
    expect(a).toContain('edit_schedule')
    expect(a).toContain('create_schedule')
    expect(a).toContain('deactivate_schedule')
  })

  it('proxies schedule upload actions to correct endpoints', () => {
    expect(ACTIONS.approve_schedule_upload.request({ upload_id: 'U1' })).toMatchObject({
      method: 'POST',
    })
    expect(ACTIONS.reject_schedule_upload.request({ upload_id: 'U1' })).toMatchObject({
      method: 'POST',
    })
  })

  it('proxies professor assignment actions to correct endpoints', () => {
    expect(ACTIONS.assign_professor.request({ schedule_id: 'S1', new_instructor_id: 'I1', new_instructor_name: 'Prof X' })).toMatchObject({
      method: 'POST', path: '/api/schedules/reassign',
    })
    expect(ACTIONS.unassign_professor.request({ schedule_id: 'S1' })).toMatchObject({
      method: 'POST', path: '/api/schedules/reassign',
    })
    expect(ACTIONS.approve_assignment_lineup.request({ lineup_id: 'L1' })).toMatchObject({
      method: 'POST',
    })
    expect(ACTIONS.reject_assignment_lineup.request({ lineup_id: 'L1', notes: 'conflict' })).toMatchObject({
      method: 'POST',
    })
  })

  it('proxies schedule CRUD to correct endpoints', () => {
    expect(ACTIONS.edit_schedule.request({ schedule_id: 'S1', room_id: 'R1' })).toMatchObject({
      method: 'PATCH',
    })
    expect(ACTIONS.create_schedule.request({ course_code: 'CS101', course_name: 'Intro', section: 'A', day_of_week: '1', start_time: '08:00', end_time: '09:30', facility_id: 'F1' })).toMatchObject({
      method: 'POST',
    })
    expect(ACTIONS.deactivate_schedule.request({ schedule_id: 'S1' })).toMatchObject({
      method: 'DELETE',
    })
  })

  it('treats school event creation as high-risk', () => {
    expect(getActionTier('create_school_event')).toBe('type')
  })

  it('treats school event cancellation as high-risk', () => {
    expect(getActionTier('cancel_school_event')).toBe('type')
  })

  it('treats booking deletion as high-risk', () => {
    expect(getActionTier('delete_booking')).toBe('type')
  })
})

// ═══════════════════════════════════════════════
// Phase 3: Destinations & quick actions
// ═══════════════════════════════════════════════

describe('Academic Head expanded destinations', () => {
  it('includes schedule_uploads destination', () => {
    expect(ah().destinations.map(d => d.id)).toContain('schedule_uploads')
  })

  it('includes schedule_calendar destination', () => {
    expect(ah().destinations.map(d => d.id)).toContain('schedule_calendar')
  })

  it('includes schedule_history destination', () => {
    expect(ah().destinations.map(d => d.id)).toContain('schedule_history')
  })

  it('includes academic_terms destination', () => {
    expect(ah().destinations.map(d => d.id)).toContain('academic_terms')
  })

  it('includes course_catalog destination', () => {
    expect(ah().destinations.map(d => d.id)).toContain('course_catalog')
  })

  it('includes notifications destination', () => {
    expect(ah().destinations.map(d => d.id)).toContain('notifications')
  })

  it('includes assignments destination', () => {
    expect(ah().destinations.map(d => d.id)).toContain('assignments')
  })
})

describe('Academic Head expanded quick actions', () => {
  it('includes pending schedule reviews', () => {
    expect(ah().quickActions.map(q => q.label)).toContain('Pending schedule reviews')
  })

  it("includes today's class schedule", () => {
    expect(ah().quickActions.map(q => q.label)).toContain("Today's class schedule")
  })

  it('includes unassigned classes', () => {
    expect(ah().quickActions.map(q => q.label)).toContain('Unassigned classes')
  })

  it('includes pending curriculum', () => {
    expect(ah().quickActions.map(q => q.label)).toContain('Pending curriculum')
  })

  it('includes reliability concerns', () => {
    expect(ah().quickActions.map(q => q.label)).toContain('Reliability concerns')
  })

  it('includes upcoming events', () => {
    expect(ah().quickActions.map(q => q.label)).toContain('Upcoming events')
  })

  it('includes pending lineups', () => {
    expect(ah().quickActions.map(q => q.label)).toContain('Pending lineups')
  })
})

// ═══════════════════════════════════════════════
// Phase 4: System prompt guidance
// ═══════════════════════════════════════════════

describe('Academic Head system prompt guidance', () => {
  it('stable prompt mentions class schedules and timetable', () => {
    const caps = resolveCapabilities([{ name: 'academic_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('class schedule')
    expect(lower).toContain('timetable')
  })

  it('stable prompt mentions professor assignment knowledge', () => {
    const caps = resolveCapabilities([{ name: 'academic_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('assign_professor')
    expect(lower).toContain('unassign')
  })

  it('stable prompt mentions approval workflow awareness', () => {
    const caps = resolveCapabilities([{ name: 'academic_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('approval workflow')
    expect(lower).toContain('get_pending_reviews')
  })

  it('stable prompt includes formatting guidance', () => {
    const caps = resolveCapabilities([{ name: 'academic_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('formatting')
    expect(lower).toContain('table')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// School Events + Exam Period Block feature: AH gains the read tool it was
// missing (previously BA-only), plus depth on the query filters and the
// shared withdraw action.
// ═══════════════════════════════════════════════════════════════════════

describe('Academic Head — school events read tool (previously missing)', () => {
  it('exposes get_school_event_blocks (mirrors the existing BA assertion)', () => {
    expect(ah().tools).toContain('get_school_event_blocks')
  })

  it("get_school_event_blocks's params list contains all five new filters", () => {
    const ep = LOOKUP_ENDPOINTS.get_school_event_blocks!
    for (const p of ['status', 'block_category', 'facility_id', 'start_date', 'end_date']) {
      expect(ep.params).toContain(p)
    }
  })

  it('exposes withdraw_school_event_request (own-request withdrawal, shared with BA)', () => {
    expect(ah().actions).toContain('withdraw_school_event_request')
  })

  it('does NOT expose any of the four BA-only approval actions', () => {
    const a = ah().actions
    expect(a).not.toContain('approve_school_event_request')
    expect(a).not.toContain('reject_school_event_request')
    expect(a).not.toContain('confirm_school_event_cancellation')
    expect(a).not.toContain('decline_school_event_cancellation')
  })

  it('destinations include school_events pointing at the academic schedules-events route', () => {
    const dest = ah().destinations.find((d) => d.id === 'school_events')
    expect(dest).toBeTruthy()
    expect(dest!.href).toBe('/academic/schedules/events')
  })
})
