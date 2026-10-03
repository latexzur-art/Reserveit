import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const mockUseDataStore = vi.fn()
vi.mock('@/lib/data-store', () => ({
  useDataStore: () => mockUseDataStore(),
}))

vi.mock('@/components/admin/dashboard/TotalBookingsToday', () => ({ TotalBookingsToday: () => <div /> }))
vi.mock('@/components/admin/dashboard/PendingApprovals', () => ({ PendingApprovals: () => <div /> }))
vi.mock('@/components/admin/dashboard/StatsCard', () => ({ StatsCard: () => <div /> }))
vi.mock('@/components/admin/dashboard/UpcomingMaintenance', () => ({ UpcomingMaintenance: () => <div /> }))
vi.mock('@/components/admin/dashboard/FacilityStatusOverview', () => ({ FacilityStatusOverview: () => <div /> }))
vi.mock('@/components/admin/dashboard/WeeklyUtilization', () => ({ WeeklyUtilization: () => <div /> }))
vi.mock('@/components/admin/dashboard/MiniCalendar', () => ({ MiniCalendar: () => <div /> }))
vi.mock('@/components/admin/dashboard/ClassSchedulesToday', () => ({ ClassSchedulesToday: () => <div /> }))
vi.mock('@/components/admin/dashboard/LiveClock', () => ({ LiveClock: () => <div /> }))
vi.mock('@/components/layout/admin/SkeletonLoader', () => ({ SkeletonLoader: () => <div>Loading</div> }))

import BuildingPage from '@/app/admin/(building)/building/page'

function mockStore(loading: boolean) {
  mockUseDataStore.mockReturnValue({
    facilities: [],
    bookings: [],
    calendarEvents: [],
    transactions: [],
    syncWithSupabase: vi.fn(),
    loading,
  })
}

describe('BuildingPage', () => {
  it('keeps hook order stable when the initial data-store loading state resolves', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockStore(true)
    const { rerender } = render(<BuildingPage />)

    mockStore(false)
    rerender(<BuildingPage />)

    const hookOrderWarning = consoleError.mock.calls.some(call =>
      String(call[0]).includes('Rendered more hooks') ||
      String(call[0]).includes('change in the order of Hooks')
    )
    expect(hookOrderWarning).toBe(false)

    consoleError.mockRestore()
  })
})
