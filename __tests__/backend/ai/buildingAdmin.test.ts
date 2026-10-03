import { describe, it, expect } from 'vitest'
import { resolveCapabilities } from '@/backend/ai/roleCapabilities'
import { LOOKUP_ENDPOINTS, TOOL_DEFINITIONS, LOOKUP_TOOL_DEFINITIONS, buildToolDefinitions } from '@/backend/ai/tools/definitions'

const ALL_TOOLS = [...TOOL_DEFINITIONS, ...LOOKUP_TOOL_DEFINITIONS]
import { getActionTier, ACTIONS, executeAction } from '@/backend/ai/actions'
import { buildStableSystemPrompt } from '@/app/api/ai/chat/_lib/prompt'

const ba = () => resolveCapabilities([{ name: 'building_admin' }])

const BA_READS = [
  'get_rates', 'get_equipment', 'get_hvac', 'get_issue_reports',
  'get_restricted_users', 'get_faq', 'get_building_bookings', 'get_class_schedules',
  'get_calendar_events', 'get_reports_analytics', 'get_directory',
  'get_payment_transactions', 'get_emergency_requests', 'get_facility_reviews',
  'get_school_event_blocks',
] as const

describe('Building Admin read tools', () => {
  it('exposes facility/equipment/oversight reads to the building admin', () => {
    const t = ba().tools
    for (const name of BA_READS) expect(t).toContain(name)
  })
  it('maps them to real proxied endpoints', () => {
    for (const name of BA_READS) expect(LOOKUP_ENDPOINTS[name]?.path).toMatch(/^\/api\//)
  })
})

describe('Building Admin write actions', () => {
  it('exposes report-triage + restricted-user actions', () => {
    const a = ba().actions
    for (const name of [
      'dismiss_issue_report', 'convert_issue_report',
      'lift_building_restriction', 'end_building_probation', 'clear_violations',
      'restrict_user', 'place_on_probation',
    ]) {
      expect(a).toContain(name)
    }
  })

  it('treats lifting a restriction / clearing violations / restricting as type-to-confirm', () => {
    expect(getActionTier('lift_building_restriction')).toBe('type')
    expect(getActionTier('clear_violations')).toBe('type')
    expect(getActionTier('restrict_user')).toBe('type')
    expect(getActionTier('place_on_probation')).toBe('type')
    expect(getActionTier('end_building_probation')).toBe('confirm')
  })

  it('proxies triage actions to the correct method + path', () => {
    expect(ACTIONS.dismiss_issue_report.request({ report_id: 'R1' })).toMatchObject({
      method: 'PATCH', path: '/api/admin/building/issue-reports/R1/dismiss',
    })
    expect(ACTIONS.convert_issue_report.request({ report_id: 'R1' })).toMatchObject({
      method: 'POST', path: '/api/admin/building/issue-reports/R1/convert',
    })
    expect(ACTIONS.lift_building_restriction.request({ user_id: 'U1' })).toMatchObject({
      method: 'POST', path: '/api/admin/building/restricted-users/U1/lift',
    })
  })

  it('proxies restrict_user and place_on_probation to the enforce endpoint', () => {
    expect(ACTIONS.restrict_user.request({ user_id: 'U1', reason: 'Repeated no-shows' })).toMatchObject({
      method: 'POST',
      path: '/api/admin/building/restricted-users/U1/enforce',
      body: { status: 'restricted', reason: 'Repeated no-shows' },
    })
    expect(ACTIONS.place_on_probation.request({ user_id: 'U2', reason: 'Late cancellations' })).toMatchObject({
      method: 'POST',
      path: '/api/admin/building/restricted-users/U2/enforce',
      body: { status: 'probation', reason: 'Late cancellations' },
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Fix get_class_schedules expanded params
// ═══════════════════════════════════════════════════════════════════════

describe('get_class_schedules expanded params', () => {
  it('LOOKUP_ENDPOINTS passes department_id, academic_term_id, and unassigned params', () => {
    const ep = LOOKUP_ENDPOINTS.get_class_schedules!
    expect(ep.path).toBe('/api/schedules/live')
    expect(ep.params).toContain('department_id')
    expect(ep.params).toContain('academic_term_id')
    expect(ep.params).toContain('unassigned')
    expect(ep.params).toContain('facility_id')
    expect(ep.params).toContain('day_of_week')
  })

  it('get_class_schedules tool definition includes department_id and unassigned params', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_class_schedules')
    expect(tool).toBeDefined()
    const props = tool!.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('department_id')
    expect(props).toHaveProperty('unassigned')
    expect(props).toHaveProperty('academic_term_id')
  })

  it('get_class_schedules description mentions timetable and professor', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_class_schedules')
    const desc = tool!.function.description.toLowerCase()
    expect(desc).toContain('timetable')
    expect(desc).toContain('professor')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 1: System prompt schedule guidance
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin system prompt schedule guidance', () => {
  it('stable prompt mentions class schedules and timetable', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('class schedule')
    expect(lower).toContain('timetable')
    expect(lower).toContain('get_class_schedules')
  })

  it('stable prompt teaches grouping by instructor for professor queries', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('instructor')
    expect(lower).toContain('group')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 2: New high-priority read tools
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin Phase 2 new read tools', () => {
  it('exposes get_calendar_events to building admin', () => {
    expect(ba().tools).toContain('get_calendar_events')
  })

  it('exposes get_reports_analytics to building admin', () => {
    expect(ba().tools).toContain('get_reports_analytics')
  })

  it('exposes get_directory to building admin', () => {
    expect(ba().tools).toContain('get_directory')
  })

  it('maps get_calendar_events to the calendar endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_calendar_events
    expect(ep).toBeDefined()
    expect(ep!.path).toMatch(/calendar/)
  })

  it('maps get_reports_analytics to the reports endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_reports_analytics
    expect(ep).toBeDefined()
    expect(ep!.path).toMatch(/reports/)
  })

  it('maps get_directory to the directory endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_directory
    expect(ep).toBeDefined()
    expect(ep!.path).toBe('/api/admin/building/directory')
  })

  it('get_calendar_events accepts facility_id and date range params', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_calendar_events')
    expect(tool).toBeDefined()
    const props = tool!.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('facility_id')
    expect(props).toHaveProperty('start_date')
    expect(props).toHaveProperty('end_date')
  })

  it('get_reports_analytics accepts metric and period params', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_reports_analytics')
    expect(tool).toBeDefined()
    const props = tool!.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('metric')
    expect(props).toHaveProperty('period')
  })

  it('get_directory accepts search, role, and category params', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_directory')
    expect(tool).toBeDefined()
    const props = tool!.function.parameters.properties as Record<string, unknown>
    expect(props).toHaveProperty('search')
    expect(props).toHaveProperty('role')
    expect(props).toHaveProperty('category')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 3: Medium-priority read tools
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin Phase 3 medium-priority read tools', () => {
  it('exposes get_payment_transactions to building admin', () => {
    expect(ba().tools).toContain('get_payment_transactions')
  })

  it('exposes get_emergency_requests to building admin', () => {
    expect(ba().tools).toContain('get_emergency_requests')
  })

  it('exposes get_facility_reviews to building admin', () => {
    expect(ba().tools).toContain('get_facility_reviews')
  })

  it('maps get_payment_transactions to payments log endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_payment_transactions
    expect(ep).toBeDefined()
    expect(ep!.path).toMatch(/payment/)
  })

  it('maps get_emergency_requests to emergency endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_emergency_requests
    expect(ep).toBeDefined()
    expect(ep!.path).toMatch(/emergency/)
  })

  it('maps get_facility_reviews to reviews endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_facility_reviews
    expect(ep).toBeDefined()
    expect(ep!.path).toMatch(/review/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 3.5: School event blocks tool
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin school event blocks tool', () => {
  it('exposes get_school_event_blocks to building admin', () => {
    expect(ba().tools).toContain('get_school_event_blocks')
  })

  it('maps get_school_event_blocks to the schedule-events endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_school_event_blocks
    expect(ep).toBeDefined()
    expect(ep!.path).toMatch(/schedule-events/)
  })

  it('get_school_event_blocks has a tool definition', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_school_event_blocks')
    expect(tool).toBeDefined()
    expect(tool!.function.description).toContain('school event')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 4: New quick actions and destinations
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin expanded destinations', () => {
  it('includes directory destination', () => {
    expect(ba().destinations.map(d => d.id)).toContain('directory')
  })

  it('includes equipment destination', () => {
    expect(ba().destinations.map(d => d.id)).toContain('equipment')
  })

  it('includes faq destination', () => {
    expect(ba().destinations.map(d => d.id)).toContain('faq')
  })

  it('includes notifications destination', () => {
    expect(ba().destinations.map(d => d.id)).toContain('notifications')
  })

  it('includes messages destination', () => {
    expect(ba().destinations.map(d => d.id)).toContain('messages')
  })

  it('includes equipment_hvac destination pointing to the HVAC page', () => {
    const dest = ba().destinations.find(d => d.id === 'equipment_hvac')
    expect(dest).toBeDefined()
    expect(dest!.href).toBe('/admin/building/equipment/hvac')
    expect(dest!.label).toBe('HVAC Fixtures')
  })

  it('includes equipment_reports destination', () => {
    expect(ba().destinations.map(d => d.id)).toContain('equipment_reports')
  })

  it('includes equipment_requests destination', () => {
    expect(ba().destinations.map(d => d.id)).toContain('equipment_requests')
  })
})

describe('Building Admin expanded quick actions', () => {
  it('includes professors with classes quick action', () => {
    expect(ba().quickActions.map(q => q.label)).toContain('Professors with classes')
  })

  it('includes room availability now quick action', () => {
    expect(ba().quickActions.map(q => q.label)).toContain('Room availability now')
  })

  it("includes this week's events quick action", () => {
    expect(ba().quickActions.map(q => q.label)).toContain("This week\u2019s events")
  })

  it('includes unassigned classes quick action', () => {
    expect(ba().quickActions.map(q => q.label)).toContain('Unassigned classes')
  })

  it('includes HVAC status quick action', () => {
    expect(ba().quickActions.map(q => q.label)).toContain('HVAC status')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 5: Response formatting guidance
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin response formatting guidance', () => {
  it('stable prompt includes table formatting instructions', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('formatting')
    expect(lower).toContain('table')
    expect(lower).toContain('course')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 6: New write actions (FAQ, maintenance, emergency, equipment)
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin new write actions', () => {
  it('exposes FAQ CRUD actions', () => {
    const a = ba().actions
    expect(a).toContain('create_faq')
    expect(a).toContain('edit_faq')
    expect(a).toContain('delete_faq')
  })

  it('exposes maintenance and emergency actions', () => {
    const a = ba().actions
    expect(a).toContain('create_maintenance')
    expect(a).toContain('approve_emergency_reschedule')
    expect(a).toContain('decline_emergency_reschedule')
    expect(a).toContain('approve_assignment_request')
  })

  it('proxies FAQ actions to correct endpoints', () => {
    expect(ACTIONS.create_faq.request({ question: 'Q?', answer: 'A' })).toMatchObject({ method: 'POST', path: '/api/faq/admin' })
    expect(ACTIONS.edit_faq.request({ faq_id: 'F1', question: 'Updated' })).toMatchObject({ method: 'PATCH', path: '/api/faq/F1' })
    expect(ACTIONS.delete_faq.request({ faq_id: 'F1' })).toMatchObject({ method: 'DELETE', path: '/api/faq/F1' })
  })

  it('proxies maintenance and emergency actions to correct endpoints', () => {
    expect(ACTIONS.create_maintenance.request({ type: 'facility', target_id: 'X', target_name: 'Room 101', schedule_date: '2026-08-15' })).toMatchObject({ method: 'POST', path: '/api/admin/building/maintenance' })
    expect(ACTIONS.approve_emergency_reschedule.request({ request_id: 'R1' })).toMatchObject({ method: 'POST' })
    expect(ACTIONS.decline_emergency_reschedule.request({ request_id: 'R1' })).toMatchObject({ method: 'POST' })
    expect(ACTIONS.approve_assignment_request.request({ request_id: 'R1', status: 'approved' })).toMatchObject({ method: 'PATCH' })
  })

  it('treats emergency reschedule approval as high-risk', () => {
    expect(getActionTier('approve_emergency_reschedule')).toBe('type')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Phase 7: School-event creation (parity with Academic Head, via RITA)
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin school-event creation', () => {
  it('exposes create_school_event and cancel_school_event actions', () => {
    const a = ba().actions
    expect(a).toContain('create_school_event')
    expect(a).toContain('cancel_school_event')
  })

  it('exposes get_school_event_blocks read tool for cancel discovery', () => {
    expect(ba().tools).toContain('get_school_event_blocks')
  })

  it('maps get_school_event_blocks to the school-events endpoint', () => {
    const ep = LOOKUP_ENDPOINTS.get_school_event_blocks
    expect(ep).toBeDefined()
    expect(ep!.path).toBe('/api/academic-head/schedule-events')
  })

  it('registers a get_school_event_blocks tool definition with the 5 grouped-read filter params', () => {
    const tool = ALL_TOOLS.find(t => t.function.name === 'get_school_event_blocks')
    expect(tool).toBeDefined()
    const props = tool!.function.parameters.properties as Record<string, unknown>
    for (const p of ['status', 'block_category', 'facility_id', 'start_date', 'end_date']) {
      expect(props).toHaveProperty(p)
    }
  })

  it('allows both building_admin and academic_head in the action registry', () => {
    expect(ACTIONS.create_school_event.allowedRoles).toContain('building_admin')
    expect(ACTIONS.create_school_event.allowedRoles).toContain('academic_head')
    expect(ACTIONS.cancel_school_event.allowedRoles).toContain('building_admin')
    expect(ACTIONS.cancel_school_event.allowedRoles).toContain('academic_head')
  })

  it('proxies create to the academic-head schedule-events endpoint (legacy single-facility shape, expanded to the new contract)', () => {
    const req = ACTIONS.create_school_event.request({ event_name: 'Founders Day', facility_id: 'F1', start_date: '2026-09-01' })
    expect(req).toMatchObject({ method: 'POST', path: '/api/academic-head/schedule-events' })
    expect(req.body).toMatchObject({ event_name: 'Founders Day', facility_ids: ['F1'], dates: ['2026-09-01'] })
  })

  it('create_school_event.request handles the new all_facilities + dates[] shape', () => {
    const req = ACTIONS.create_school_event.request({ event_name: 'Finals Week', all_facilities: true, dates: ['2026-10-01', '2026-10-02'] })
    expect(req).toMatchObject({ method: 'POST', path: '/api/academic-head/schedule-events' })
    expect(req.body).toMatchObject({ event_name: 'Finals Week', all_facilities: true, dates: ['2026-10-01', '2026-10-02'] })
  })

  it('create_school_event.validate rejects missing facilities and missing dates', () => {
    expect(ACTIONS.create_school_event.validate?.({ event_name: 'X' })).toBeTypeOf('string')
    expect(ACTIONS.create_school_event.validate?.({ event_name: 'X', start_date: '2026-09-01' })).toBeTypeOf('string')
    expect(ACTIONS.create_school_event.validate?.({ event_name: 'X', facility_ids: ['F1'] })).toBeTypeOf('string')
    expect(ACTIONS.create_school_event.validate?.({ event_name: 'X', facility_ids: ['F1'], start_date: '2026-09-01' })).toBeNull()
  })

  it('cancel_school_event routes group_id to the group endpoint, event_id to the legacy endpoint', () => {
    expect(ACTIONS.cancel_school_event.request({ group_id: 'G1' })).toMatchObject({
      method: 'PATCH', path: '/api/academic-head/schedule-events/group/G1', body: { action: 'request_cancellation' },
    })
    expect(ACTIONS.cancel_school_event.request({ event_id: 'E1' })).toMatchObject({
      method: 'DELETE', path: '/api/academic-head/schedule-events/E1',
    })
  })

  it('cancel_school_event.validate requires exactly one of event_id/group_id', () => {
    expect(ACTIONS.cancel_school_event.validate?.({})).toBeTypeOf('string')
    expect(ACTIONS.cancel_school_event.validate?.({ group_id: 'G1' })).toBeNull()
    expect(ACTIONS.cancel_school_event.validate?.({ event_id: 'E1' })).toBeNull()
  })

  it('treats school-event create/cancel as type-to-confirm (high risk)', () => {
    expect(getActionTier('create_school_event')).toBe('type')
    expect(getActionTier('cancel_school_event')).toBe('type')
  })

  it('surfaces the school-event actions in the BA system prompt', () => {
    const prompt = buildStableSystemPrompt(resolveCapabilities([{ name: 'building_admin' }]), 'agentic')
    expect(prompt).toContain('create_school_event')
    expect(prompt).toContain('cancel_school_event')
  })

  it('adds a create-school-event quick action', () => {
    expect(ba().quickActions.map(q => q.label)).toContain('Create a school event')
  })

  it('surfaces get_school_event_blocks in the tools the model receives', () => {
    const names = buildToolDefinitions(ba()).map(t => t.function.name)
    expect(names).toContain('get_school_event_blocks')
  })

  it("executeAction's role gate admits building_admin but still blocks faculty", async () => {
    // A 403 means the middle gate rejected the caller. building_admin must get PAST it
    // (the proxied fetch then fails against the unreachable origin → non-403); faculty
    // must be stopped at the gate with 403.
    const ctx = { cookie: null, origin: 'http://127.0.0.1:0', userId: 'u' }
    const asBA = await executeAction('create_school_event',
      { event_name: 'X', facility_id: 'F1', start_date: '2026-09-01' }, { ...ctx, roles: ['building_admin'] })
    const asFaculty = await executeAction('create_school_event',
      { event_name: 'X', facility_id: 'F1', start_date: '2026-09-01' }, { ...ctx, roles: ['faculty'] })
    expect(asBA.status).not.toBe(403)
    expect(asFaculty.status).toBe(403)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// School Events + Exam Period Block: new BA-only approval actions + the
// shared withdraw action. The dedicated "assert academic_head is rejected"
// tests exist because a same-list-both-ways copy-paste bug would otherwise
// pass silently.
// ═══════════════════════════════════════════════════════════════════════

describe('Building Admin — school-event approval actions (BA-only)', () => {
  const BA_ONLY_ACTIONS = [
    ['approve_school_event_request', 'approve'],
    ['reject_school_event_request', 'reject'],
    ['confirm_school_event_cancellation', 'confirm_cancellation'],
    ['decline_school_event_cancellation', 'decline_cancellation'],
  ] as const

  it.each(BA_ONLY_ACTIONS)('%s: allowedRoles is building_admin only, academic_head is explicitly rejected', (actionName) => {
    expect(ACTIONS[actionName].allowedRoles).toEqual(['building_admin'])
    expect(ACTIONS[actionName].allowedRoles).not.toContain('academic_head')
  })

  it.each(BA_ONLY_ACTIONS)('%s: proxies PATCH to the group endpoint with the matching action', (actionName, patchAction) => {
    const req = ACTIONS[actionName].request({ group_id: 'G1' })
    expect(req).toMatchObject({ method: 'PATCH', path: '/api/academic-head/schedule-events/group/G1', body: { action: patchAction } })
  })

  it.each(BA_ONLY_ACTIONS)('%s: is wired into building_admin.actions but NOT academic_head.actions', (actionName) => {
    expect(ba().actions).toContain(actionName)
    expect(resolveCapabilities([{ name: 'academic_head' }]).actions).not.toContain(actionName)
  })

  it.each(BA_ONLY_ACTIONS)('%s: is a type-to-confirm (high risk) action', (actionName) => {
    expect(getActionTier(actionName)).toBe('type')
  })

  it('withdraw_school_event_request accepts both academic_head and building_admin', () => {
    expect(ACTIONS.withdraw_school_event_request.allowedRoles).toContain('academic_head')
    expect(ACTIONS.withdraw_school_event_request.allowedRoles).toContain('building_admin')
    expect(ba().actions).toContain('withdraw_school_event_request')
  })

  it('withdraw_school_event_request proxies PATCH action=withdraw to the group endpoint', () => {
    const req = ACTIONS.withdraw_school_event_request.request({ group_id: 'G1' })
    expect(req).toMatchObject({ method: 'PATCH', path: '/api/academic-head/schedule-events/group/G1', body: { action: 'withdraw' } })
  })

  it('withdraw_school_event_request is a type-to-confirm (high risk) action, same as the other 4 new actions', () => {
    expect(getActionTier('withdraw_school_event_request')).toBe('type')
  })

  it('adds a block-an-exam-period quick action', () => {
    expect(ba().quickActions.map((q) => q.label)).toContain('Block an exam period')
  })

  it('destinations include school_events pointing at the building school-events route', () => {
    const dest = ba().destinations.find((d) => d.id === 'school_events')
    expect(dest).toBeTruthy()
    expect(dest!.href).toBe('/admin/building/school-events')
  })
})
