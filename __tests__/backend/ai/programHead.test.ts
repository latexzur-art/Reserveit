import { describe, it, expect } from 'vitest'
import { resolveCapabilities, type AssistantActionType } from '@/backend/ai/roleCapabilities'
import { LOOKUP_ENDPOINTS, TOOL_DEFINITIONS, LOOKUP_TOOL_DEFINITIONS } from '@/backend/ai/tools/definitions'
import { getActionTier, ACTIONS } from '@/backend/ai/actions'
import { buildStableSystemPrompt } from '@/app/api/ai/chat/_lib/prompt'

const ALL_TOOLS = [...TOOL_DEFINITIONS, ...LOOKUP_TOOL_DEFINITIONS]
const ph = () => resolveCapabilities([{ name: 'program_head' }])

// ═══════════════════════════════════════════════
// Original tests (preserved)
// ═══════════════════════════════════════════════

const PH_READS = [
  'get_courses',
  'get_schedule_uploads',
  'get_professor_assignments',
  'get_approved_schedules',
  'get_sections',
  'get_upload_history',
  'get_school_events',
] as const

describe('Program Head read tools', () => {
  it('exposes the department-management read tools to the program head', () => {
    const tools = ph().tools
    for (const t of PH_READS) expect(tools).toContain(t)
  })

  it('does NOT expose get_curriculum_pending — its endpoint is academic_head-only (would 403)', () => {
    expect(ph().tools).not.toContain('get_curriculum_pending')
  })

  it('does not leak them to the external client', () => {
    const tools = resolveCapabilities([{ name: 'external_client' }]).tools
    for (const t of PH_READS) expect(tools).not.toContain(t)
  })

  it('maps every new read tool to a real proxied endpoint', () => {
    for (const t of PH_READS) {
      expect(LOOKUP_ENDPOINTS[t]?.path).toMatch(/^\/api\//)
    }
  })
})

describe('Program Head write actions — curriculum batch lifecycle', () => {
  it('exposes submit / publish / request-delete to the program head', () => {
    const a = ph().actions
    expect(a).toContain('submit_curriculum_batch')
    expect(a).toContain('publish_curriculum_batch')
    expect(a).toContain('request_delete_curriculum_batch')
  })

  it('publish is type-to-confirm (wide blast radius); submit is one-click confirm', () => {
    expect(getActionTier('publish_curriculum_batch')).toBe('type')
    expect(getActionTier('submit_curriculum_batch')).toBe('confirm')
  })

  it('every batch action proxies a POST to /api/courses/batch/[id]/*', () => {
    for (const t of ['submit_curriculum_batch', 'publish_curriculum_batch', 'request_delete_curriculum_batch'] as const) {
      const spec = ACTIONS[t].request({ batch_id: 'B1' })
      expect(spec.method).toBe('POST')
      expect(spec.path).toContain('/api/courses/batch/B1/')
    }
  })
})

// ═══════════════════════════════════════════════
// Phase 1: New read tools
// ═══════════════════════════════════════════════

describe('Program Head new read tools', () => {
  it('exposes get_faculty_availability for department faculty', () => {
    expect(ph().tools).toContain('get_faculty_availability')
  })

  it('exposes get_notifications', () => {
    expect(ph().tools).toContain('get_notifications')
  })

  it('exposes get_change_requests for schedule change history', () => {
    expect(ph().tools).toContain('get_change_requests')
  })

  it('maps get_faculty_availability to faculty availability endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_faculty_availability!
    expect(ep.path).toBe('/api/faculty/availability')
  })

  it('maps get_notifications to notifications endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_notifications!
    expect(ep.path).toBe('/api/notifications')
  })

  it('maps get_change_requests to change-requests endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_change_requests!
    expect(ep.path).toBe('/api/schedules/change-requests')
  })

  it('get_faculty_availability has department_id param', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_faculty_availability')!
    expect(tool).toBeDefined()
    const props = tool.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('department_id')
  })

  it('get_change_requests has status param', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_change_requests')!
    expect(tool).toBeDefined()
    const props = tool.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('status')
  })

  it('get_faculty_availability description mentions Program Head', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_faculty_availability')!
    expect(tool).toBeDefined()
    expect(tool.function.description).toContain('Program Head')
  })

  it('get_change_requests description mentions Program Head', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_change_requests')!
    expect(tool).toBeDefined()
    expect(tool.function.description).toContain('Program Head')
  })
})

// ═══════════════════════════════════════════════
// Phase 2: New write actions
// ═══════════════════════════════════════════════

describe('Program Head new write actions', () => {
  it('exposes assign_professor and unassign_professor', () => {
    const a = ph().actions
    expect(a).toContain('assign_professor')
    expect(a).toContain('unassign_professor')
  })

  it('exposes submit_schedule_upload', () => {
    expect(ph().actions).toContain('submit_schedule_upload')
  })

  it('exposes create_school_event_ph and cancel_school_event_ph', () => {
    const a = ph().actions
    expect(a).toContain('create_school_event_ph')
    expect(a).toContain('cancel_school_event_ph')
  })

  it('assign_professor allowedRoles includes program_head', () => {
    expect(ACTIONS.assign_professor.allowedRoles).toContain('program_head')
  })

  it('unassign_professor allowedRoles includes program_head', () => {
    expect(ACTIONS.unassign_professor.allowedRoles).toContain('program_head')
  })

  it('submit_schedule_upload allowedRoles is program_head only', () => {
    expect(ACTIONS.submit_schedule_upload.allowedRoles).toEqual(['program_head'])
  })

  it('create_school_event_ph allowedRoles is program_head only', () => {
    expect(ACTIONS.create_school_event_ph.allowedRoles).toEqual(['program_head'])
  })

  it('cancel_school_event_ph allowedRoles is program_head only', () => {
    expect(ACTIONS.cancel_school_event_ph.allowedRoles).toEqual(['program_head'])
  })

  it('proxies assign_professor to /api/schedules/reassign with action=reassign', () => {
    const spec = ACTIONS.assign_professor.request({ schedule_id: 'S1', new_instructor_id: 'I1', new_instructor_name: 'Prof X' })
    expect(spec).toMatchObject({ method: 'POST', path: '/api/schedules/reassign' })
    expect(spec.body).toMatchObject({ schedule_id: 'S1', new_instructor_id: 'I1', new_instructor_name: 'Prof X', action: 'reassign' })
  })

  it('proxies unassign_professor to /api/schedules/reassign with action=unassign', () => {
    const spec = ACTIONS.unassign_professor.request({ schedule_id: 'S1' })
    expect(spec).toMatchObject({ method: 'POST', path: '/api/schedules/reassign' })
    expect(spec.body).toMatchObject({ schedule_id: 'S1', action: 'unassign' })
  })

  it('proxies submit_schedule_upload to /api/schedules/uploads/[id]/submit', () => {
    const spec = ACTIONS.submit_schedule_upload.request({ upload_id: 'U1' })
    expect(spec.method).toBe('POST')
    expect(spec.path).toContain('/api/schedules/uploads/U1/submit')
  })

  it('proxies create_school_event_ph to /api/program-head/schedule-events', () => {
    const spec = ACTIONS.create_school_event_ph.request({
      event_name: 'IT Week',
      facility_ids: ['F1', 'F2'],
      booking_date: '2026-08-15',
    })
    expect(spec.method).toBe('POST')
    expect(spec.path).toBe('/api/program-head/schedule-events')
  })

  it('proxies cancel_school_event_ph to DELETE /api/program-head/schedule-events/[id]', () => {
    const spec = ACTIONS.cancel_school_event_ph.request({ event_id: 'E1' })
    expect(spec.method).toBe('DELETE')
    expect(spec.path).toContain('/api/program-head/schedule-events/E1')
  })

  it('submit_schedule_upload is one-click confirm (not high-risk)', () => {
    expect(getActionTier('submit_schedule_upload')).toBe('confirm')
  })

  it('create_school_event_ph is type-to-confirm (high-risk)', () => {
    expect(getActionTier('create_school_event_ph')).toBe('type')
  })

  it('cancel_school_event_ph is one-click confirm', () => {
    expect(getActionTier('cancel_school_event_ph')).toBe('confirm')
  })
})

// ═══════════════════════════════════════════════
// Phase 3: Destinations & quick actions
// ═══════════════════════════════════════════════

describe('Program Head expanded destinations', () => {
  it('includes upload_history destination', () => {
    expect(ph().destinations.map(d => d.id)).toContain('upload_history')
  })

  it('includes faculty destination', () => {
    expect(ph().destinations.map(d => d.id)).toContain('faculty')
  })

  it('includes facilities destination', () => {
    expect(ph().destinations.map(d => d.id)).toContain('facilities')
  })

  it('includes profile destination', () => {
    expect(ph().destinations.map(d => d.id)).toContain('profile')
  })

  it('includes payment destination', () => {
    expect(ph().destinations.map(d => d.id)).toContain('payment')
  })

  it('includes notifications destination', () => {
    expect(ph().destinations.map(d => d.id)).toContain('notifications')
  })

  it('preserves original destinations', () => {
    const ids = ph().destinations.map(d => d.id)
    expect(ids).toContain('book')
    expect(ids).toContain('my_bookings')
    expect(ids).toContain('courses')
    expect(ids).toContain('curriculum')
    expect(ids).toContain('schedule_uploads')
    expect(ids).toContain('approved_schedules')
    expect(ids).toContain('school_events')
    expect(ids).toContain('calendar')
    expect(ids).toContain('assignments')
    expect(ids).toContain('sections')
  })
})

describe('Program Head expanded quick actions', () => {
  it('has at least 8 quick actions', () => {
    expect(ph().quickActions.length).toBeGreaterThanOrEqual(8)
  })

  it('includes My department faculty', () => {
    expect(ph().quickActions.map(q => q.label)).toContain('My department faculty')
  })

  it('includes Pending assignments', () => {
    expect(ph().quickActions.map(q => q.label)).toContain('Pending assignments')
  })

  it('includes School events', () => {
    expect(ph().quickActions.map(q => q.label)).toContain('School events')
  })

  it('includes Approved schedules', () => {
    expect(ph().quickActions.map(q => q.label)).toContain('Approved schedules')
  })

  it('includes Notifications', () => {
    expect(ph().quickActions.map(q => q.label)).toContain('Notifications')
  })
})

// ═══════════════════════════════════════════════
// Phase 4: System prompt guidance
// ═══════════════════════════════════════════════

describe('Program Head system prompt guidance', () => {
  it('stable prompt mentions schedule uploads workflow', () => {
    const caps = resolveCapabilities([{ name: 'program_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('schedule upload')
    expect(lower).toContain('submit')
  })

  it('stable prompt mentions school events workflow', () => {
    const caps = resolveCapabilities([{ name: 'program_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('school event')
  })

  it('stable prompt mentions professor assignment workflow', () => {
    const caps = resolveCapabilities([{ name: 'program_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('assign_professor')
    expect(lower).toContain('unassign_professor')
  })

  it('stable prompt mentions submit-for-approval workflow', () => {
    const caps = resolveCapabilities([{ name: 'program_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('submit work for approval')
  })

  it('stable prompt mentions change requests', () => {
    const caps = resolveCapabilities([{ name: 'program_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('change request')
  })

  it('stable prompt mentions submit_schedule_change_request action', () => {
    const caps = resolveCapabilities([{ name: 'program_head' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    expect(prompt).toContain('submit_schedule_change_request')
  })
})

// ═══════════════════════════════════════════════
// Phase 5: Self-service actions + change requests
// ═══════════════════════════════════════════════

describe('Program Head self-service actions', () => {
  it('exposes accept_alternative', () => {
    expect(ph().actions).toContain('accept_alternative')
  })

  it('exposes submit_appeal', () => {
    expect(ph().actions).toContain('submit_appeal')
  })

  it('exposes request_reliability_reset', () => {
    expect(ph().actions).toContain('request_reliability_reset')
  })

  it('exposes emergency_cancel_my_booking', () => {
    expect(ph().actions).toContain('emergency_cancel_my_booking')
  })

  it('exposes report_equipment_issue', () => {
    expect(ph().actions).toContain('report_equipment_issue')
  })

  it('exposes submit_facility_review', () => {
    expect(ph().actions).toContain('submit_facility_review')
  })

  it('all self-service actions have program_head in allowedRoles', () => {
    const selfService = [
      'cancel_my_booking', 'accept_alternative', 'submit_appeal',
      'request_reliability_reset', 'emergency_cancel_my_booking',
      'report_equipment_issue', 'submit_facility_review',
    ]
    for (const action of selfService) {
      expect(ACTIONS[action as AssistantActionType].allowedRoles).toContain('program_head')
    }
  })
})

describe('Program Head schedule change request action', () => {
  it('exposes submit_schedule_change_request', () => {
    expect(ph().actions).toContain('submit_schedule_change_request')
  })

  it('submit_schedule_change_request allowedRoles includes program_head', () => {
    expect(ACTIONS.submit_schedule_change_request.allowedRoles).toContain('program_head')
  })

  it('proxies submit_schedule_change_request to POST /api/schedules/change-requests', () => {
    const spec = ACTIONS.submit_schedule_change_request.request({
      class_schedule_id: 'CS1',
      change_type: 'modify',
      reason: 'Room conflict',
    })
    expect(spec.method).toBe('POST')
    expect(spec.path).toBe('/api/schedules/change-requests')
  })

  it('submit_schedule_change_request is one-click confirm', () => {
    expect(getActionTier('submit_schedule_change_request')).toBe('confirm')
  })
})

// ═══════════════════════════════════════════════
// Negative tests
// ═══════════════════════════════════════════════

describe('Program Head negative tests', () => {
  it('does NOT expose approve_booking (Academic Head only)', () => {
    expect(ph().actions).not.toContain('approve_booking')
  })

  it('does NOT expose reject_booking (Academic Head only)', () => {
    expect(ph().actions).not.toContain('reject_booking')
  })

  it('does NOT expose approve_curriculum_batch (Academic Head only)', () => {
    expect(ph().actions).not.toContain('approve_curriculum_batch')
  })

  it('does NOT expose get_curriculum_pending (endpoint 403s for PH)', () => {
    expect(ph().tools).not.toContain('get_curriculum_pending')
  })
})
