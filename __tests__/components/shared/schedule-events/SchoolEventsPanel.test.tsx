import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { SchoolEventsPanel } from '@/components/shared/schedule-events/SchoolEventsPanel'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'ba-1', full_name: 'BA User', roles: [{ name: 'building_admin' }] }, loading: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const facilities = [
  { id: 'f1', name: 'Gym', room_number: 'G1' },
  { id: 'f2', name: 'Auditorium', room_number: 'A1' },
]

function mockFetchSequence(responses: Record<string, any>) {
  global.fetch = vi.fn((url: any) => {
    const key = Object.keys(responses).find((k) => String(url).includes(k))
    const body = key ? responses[key] : { events: [] }
    return Promise.resolve({ ok: true, json: async () => body } as Response)
  }) as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SchoolEventsPanel — mode toggle', () => {
  it('swaps the facility-default and day-picker UI between School Event and Exam Period modes', async () => {
    mockFetchSequence({ 'facilities?all=true': { facilities }, 'schedule-events': { events: [] } })
    render(<SchoolEventsPanel viewerRole="building_admin" />)

    await waitFor(() => expect(screen.getByText(/select facilities/i)).toBeInTheDocument())
    // School Event mode starts with an empty facility selection
    expect(screen.getByText(/select facilities\.\.\./i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /exam period/i }))

    // Exam Period mode pre-checks every facility
    await waitFor(() => expect(screen.getByText(/all 2 facilities selected/i)).toBeInTheDocument())
    expect(screen.queryByLabelText(/start date/i)).not.toBeInTheDocument()
  })
})

describe('SchoolEventsPanel — submit shapes', () => {
  it('School Event mode posts the legacy-compatible shape (start_date/end_date)', async () => {
    mockFetchSequence({ 'facilities?all=true': { facilities }, 'schedule-events': { events: [] } })
    render(<SchoolEventsPanel viewerRole="building_admin" />)
    await waitFor(() => expect(screen.getByText(/select facilities/i)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/event (title|name)/i), { target: { value: 'Founders Day' } })
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-09-03' } })

    fireEvent.click(screen.getByText(/select facilities/i))
    fireEvent.click(await screen.findByText('Gym'))

    const postMock = vi.fn((_url: any, _opts: any) => Promise.resolve({ ok: true, json: async () => ({ success: true, group_id: 'g1' }) } as Response))
    global.fetch = vi.fn((url: any, opts?: any) => {
      if (opts?.method === 'POST') return postMock(url, opts)
      return Promise.resolve({ ok: true, json: async () => ({ facilities, events: [] }) } as Response)
    }) as any

    fireEvent.click(screen.getByRole('button', { name: /create (school event|exam block)/i }))

    await waitFor(() => expect(postMock).toHaveBeenCalled())
    const body = JSON.parse(postMock.mock.calls[0]![1].body)
    expect(body.mode).toBe('school_event')
    expect(body.start_date).toBe('2026-09-01')
    expect(body.end_date).toBe('2026-09-03')
    expect(body.facility_ids).toEqual(['f1'])
  })

  it('Exam Period mode posts all_facilities + the picked dates[]', async () => {
    mockFetchSequence({ 'facilities?all=true': { facilities }, 'schedule-events': { events: [] } })
    render(<SchoolEventsPanel viewerRole="building_admin" />)
    await waitFor(() => expect(screen.getByText(/select facilities/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: /exam period/i }))
    fireEvent.change(screen.getByLabelText(/event (title|name)/i), { target: { value: 'Finals Week' } })

    const postMock = vi.fn((_url: any, _opts: any) => Promise.resolve({ ok: true, json: async () => ({ success: true, group_id: 'g2' }) } as Response))
    global.fetch = vi.fn((url: any, opts?: any) => {
      if (opts?.method === 'POST') return postMock(url, opts)
      return Promise.resolve({ ok: true, json: async () => ({ facilities, events: [] }) } as Response)
    }) as any

    // Pick a day via the calendar grid (react-day-picker renders gridcell buttons)
    const dayButtons = screen.getAllByRole('gridcell')
    fireEvent.click(within(dayButtons[10]).getAllByRole('button')[0])

    fireEvent.click(screen.getByRole('button', { name: /create (school event|exam block)/i }))

    await waitFor(() => expect(postMock).toHaveBeenCalled())
    const body = JSON.parse(postMock.mock.calls[0]![1].body)
    expect(body.mode).toBe('exam_period')
    expect(body.all_facilities).toBe(true)
    expect(Array.isArray(body.dates)).toBe(true)
    expect(body.dates.length).toBeGreaterThan(0)
    expect(body.start_time).toBe('00:00')
    expect(body.end_time).toBe('23:59')
  })
})

describe('SchoolEventsPanel — history list', () => {
  it('shows correct aggregate day/facility counts for a multi-row group fixture', async () => {
    mockFetchSequence({
      'facilities?all=true': { facilities },
      'schedule-events': {
        events: [
          {
            group_id: 'grp-1',
            event_name: 'Finals Week',
            block_category: 'exam_period',
            current_status: 'auto_approved',
            created_by_name: 'AH User',
            created_by_id: 'ah-1',
            dates: ['2026-10-01', '2026-10-02', '2026-10-03'],
            facilities: [
              { id: 'f1', name: 'Gym', room_number: 'G1' },
              { id: 'f2', name: 'Auditorium', room_number: 'A1' },
            ],
            booking_ids: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
          },
        ],
      },
    })

    render(<SchoolEventsPanel viewerRole="building_admin" />)

    await waitFor(() => expect(screen.getByText('Finals Week')).toBeInTheDocument())
    expect(screen.getByText(/3 days? · 2 facilit/i)).toBeInTheDocument()
  })
})
