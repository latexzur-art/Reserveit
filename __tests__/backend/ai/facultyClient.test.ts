import { describe, it, expect } from 'vitest'
import { resolveCapabilities } from '@/backend/ai/roleCapabilities'
import { LOOKUP_ENDPOINTS } from '@/backend/ai/tools/definitions'
import { ACTIONS } from '@/backend/ai/actions'

const client = () => resolveCapabilities([{ name: 'external_client' }])
const faculty = () => resolveCapabilities([{ name: 'faculty' }])

describe('Client & Faculty self-service reads', () => {
  it('gives the client notifications and the faculty notifications + their class schedule', () => {
    expect(client().tools).toContain('get_notifications')
    expect(faculty().tools).toContain('get_notifications')
    expect(faculty().tools).toContain('get_my_schedule')
  })
  it('maps the new reads to real endpoints', () => {
    expect(LOOKUP_ENDPOINTS.get_notifications?.path).toBe('/api/notifications')
    expect(LOOKUP_ENDPOINTS.get_my_schedule?.path).toMatch(/^\/api\//)
  })
})

describe('Client & Faculty self-service writes', () => {
  it('exposes emergency-cancel, issue-report and facility-review to both', () => {
    for (const caps of [client(), faculty()]) {
      expect(caps.actions).toContain('emergency_cancel_my_booking')
      expect(caps.actions).toContain('report_equipment_issue')
      expect(caps.actions).toContain('submit_facility_review')
    }
  })

  it('requires a category + description to report an equipment issue', () => {
    expect(ACTIONS.report_equipment_issue.required).toContain('category')
    expect(ACTIONS.report_equipment_issue.required).toContain('description')
  })

  it('proxies each self-service write to the right endpoint', () => {
    expect(ACTIONS.emergency_cancel_my_booking.request({ booking_id: 'B1', reason: 'water leak in the room' })).toMatchObject({
      method: 'POST', path: '/api/bookings/B1/self-emergency-cancel',
    })
    expect(ACTIONS.report_equipment_issue.request({ category: 'projector', description: 'no display output' })).toMatchObject({
      method: 'POST', path: '/api/equipment-reports',
    })
    expect(ACTIONS.submit_facility_review.request({ facility_id: 'F1', rating: 5 })).toMatchObject({
      method: 'POST', path: '/api/facilities/F1/reviews',
    })
  })
})
