import { describe, it, expect } from 'vitest'
import { resolveCapabilities } from '@/backend/ai/roleCapabilities'
import { LOOKUP_ENDPOINTS } from '@/backend/ai/tools/definitions'
import { ACTIONS } from '@/backend/ai/actions'

const it_ = () => resolveCapabilities([{ name: 'it_admin' }])

const IT_READS = [
  'get_academic_terms', 'get_tech_equipment', 'get_tech_reports',
  'get_assignment_requests', 'get_departments',
] as const

describe('IT Admin read tools', () => {
  it('exposes terms / tech-equipment / tech-reports / assign-requests / departments', () => {
    const t = it_().tools
    for (const name of IT_READS) expect(t).toContain(name)
  })
  it('maps the new reads to real proxied endpoints', () => {
    for (const name of ['get_academic_terms', 'get_tech_equipment', 'get_tech_reports', 'get_assignment_requests'] as const) {
      expect(LOOKUP_ENDPOINTS[name]?.path).toMatch(/^\/api\//)
    }
  })
})

describe('IT Admin write actions', () => {
  it('exposes user-lifecycle + tech triage actions', () => {
    const a = it_().actions
    for (const name of ['reset_user_password', 'issue_user_credit', 'decide_assignment_request', 'update_tech_report']) {
      expect(a).toContain(name)
    }
  })

  it('requires amount + reason to issue a credit', () => {
    expect(ACTIONS.issue_user_credit.required).toContain('amount_centavos')
    expect(ACTIONS.issue_user_credit.required).toContain('reason')
  })

  it('proxies each action to the right method + path', () => {
    expect(ACTIONS.reset_user_password.request({ user_id: 'U1' })).toMatchObject({
      method: 'POST', path: '/api/admin/users/U1/reset-password',
    })
    expect(ACTIONS.issue_user_credit.request({ user_id: 'U1', amount_centavos: 500, reason: 'goodwill credit' })).toMatchObject({
      method: 'POST', path: '/api/admin/users/U1/issue-credit',
    })
    expect(ACTIONS.decide_assignment_request.request({ request_id: 'A1', status: 'approved' })).toMatchObject({
      method: 'PATCH', path: '/api/equipment-assignment-requests/A1',
    })
    expect(ACTIONS.update_tech_report.request({ report_id: 'R1', status: 'resolved' })).toMatchObject({
      method: 'PATCH', path: '/api/equipment-reports/R1',
    })
  })
})
