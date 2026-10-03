import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock the hook
const mockRefresh = vi.fn()
const mockCancelBooking = vi.fn()
const mockReviewBooking = vi.fn()
const mockProposeChanges = vi.fn()
const mockDeleteBooking = vi.fn()
const mockSetStatusFilter = vi.fn()
const mockSetDepartmentId = vi.fn()
const mockSetSortBy = vi.fn()
const mockSetSearch = vi.fn()
const mockSetPage = vi.fn()

const mockBooking = {
  id: 'b1',
  referenceNumber: 'REF-001',
  bookingDate: '2026-04-01',
  startTime: '09:00',
  endTime: '10:00',
  durationMinutes: 60,
  status: 'approved',
  bookingPurpose: 'academic',
  purpose: 'Lecture on Data Structures',
  eventName: null,
  expectedAttendees: 30,
  decisionScore: 85,
  createdAt: '2026-03-20T10:00:00Z',
  mismatchFlag: null,
  courseCode: null,
  courseDepartmentCode: null,
  courseName: null,
  sessionType: null,
  facultyId: 'u1',
  facultyName: 'Dr. Juan dela Cruz',
  facultyEmail: 'juan@sti.edu.ph',
  departmentId: 'd1',
  department: 'Computer Science',
  departmentCode: 'BSCS',
  facilityId: 'f1',
  facilityName: 'Room 101',
  roomNumber: '101',
  floorNumber: 1,
  buildingName: 'Main Building',
}

vi.mock('@/hooks/academic-head/useAcademicReservations', () => ({
  useAcademicReservations: () => ({
    bookings: [mockBooking],
    departments: [
      { id: 'd1', code: 'BSCS', name: 'Computer Science', activeBookings: 5 },
      { id: 'd2', code: 'BSBA', name: 'Business Admin', activeBookings: 3 },
    ],
    total: 1,
    totalPages: 1,
    page: 1,
    setPage: mockSetPage,
    loading: false,
    statusFilter: '',
    setStatusFilter: mockSetStatusFilter,
    departmentId: '',
    setDepartmentId: mockSetDepartmentId,
    search: '',
    setSearch: mockSetSearch,
    sortBy: 'date_asc',
    setSortBy: mockSetSortBy,
    refresh: mockRefresh,
    cancelBooking: mockCancelBooking,
    reviewBooking: mockReviewBooking,
    proposeChanges: mockProposeChanges,
    deleteBooking: mockDeleteBooking,
  }),
}))

// Mock ReservationInfoCard to verify props
vi.mock('@/app/academic/_components/ReservationInfoCard', () => ({
  ReservationInfoCard: (props: any) => (
    <div data-testid="reservation-info-card">
      <span data-testid="card-booking-id">{props.booking?.id}</span>
      <span data-testid="card-has-onCancel">{typeof props.onCancel === 'function' ? 'yes' : 'no'}</span>
      <span data-testid="card-has-onProposeChanges">{typeof props.onProposeChanges === 'function' ? 'yes' : 'no'}</span>
      <span data-testid="card-has-onReview">{typeof props.onReview === 'function' ? 'yes' : 'no'}</span>
      <span data-testid="card-has-facilities">{Array.isArray(props.facilities) ? 'yes' : 'no'}</span>
    </div>
  ),
  FacilityOption: {} as any,
}))

// Mock fetch for facilities
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AcademicFacilityReservationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/facilities')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            facilities: [
              { id: 'f1', name: 'Room 101', room_number: '101' },
              { id: 'f2', name: 'Gymnasium', room_number: null },
            ],
          }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  it('renders booking cards with action props passed to ReservationInfoCard', async () => {
    const { default: Page } = await import('@/app/academic/reservations/page')
    render(<Page />)

    const card = screen.getByTestId('reservation-info-card')
    expect(card).toBeTruthy()
    expect(screen.getByTestId('card-booking-id').textContent).toBe('b1')
    expect(screen.getByTestId('card-has-onCancel').textContent).toBe('yes')
    expect(screen.getByTestId('card-has-onProposeChanges').textContent).toBe('yes')
    expect(screen.getByTestId('card-has-onReview').textContent).toBe('yes')
    expect(screen.getByTestId('card-has-facilities').textContent).toBe('yes')
  })

  it('renders status filter tabs', async () => {
    const { default: Page } = await import('@/app/academic/reservations/page')
    render(<Page />)

    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getByText('Pending Review')).toBeTruthy()
    expect(screen.getByText('Action Required')).toBeTruthy()
    expect(screen.getByText('Declined')).toBeTruthy()
    expect(screen.getByText('Cancelled')).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()
  })

  it('renders department filter dropdown', async () => {
    const { default: Page } = await import('@/app/academic/reservations/page')
    render(<Page />)

    const deptSelect = screen.getByDisplayValue('All Departments')
    expect(deptSelect).toBeTruthy()
    expect(screen.getByText('BSCS')).toBeTruthy()
    expect(screen.getByText('BSBA')).toBeTruthy()
  })

  it('renders sort dropdown', async () => {
    const { default: Page } = await import('@/app/academic/reservations/page')
    render(<Page />)

    const sortSelect = screen.getByDisplayValue('Oldest First')
    expect(sortSelect).toBeTruthy()
  })

  it('renders search input', async () => {
    const { default: Page } = await import('@/app/academic/reservations/page')
    render(<Page />)

    const searchInput = screen.getByPlaceholderText('Search by faculty, facility, reference code, or purpose...')
    expect(searchInput).toBeTruthy()
  })
})
