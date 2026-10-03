import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import React from 'react'

// ---- Mocks for data hooks ----
const mockRefreshReviews = vi.fn()
const mockSubmitReview = vi.fn()
const mockBatchApprove = vi.fn().mockResolvedValue({ approved: 1, failed: 0 })

const mockRefreshReservations = vi.fn()
const mockCancelBooking = vi.fn()
const mockReviewBooking = vi.fn()
const mockProposeChanges = vi.fn()
const mockDeleteBooking = vi.fn()
const mockBulkDeleteBookings = vi.fn()
const mockSetSearch = vi.fn()
const mockSetDepartmentId = vi.fn()
const mockSetStatusFilter = vi.fn()
const mockSetSortBy = vi.fn()
const mockSetPage = vi.fn()
const mockSetFromDate = vi.fn()
const mockSetToDate = vi.fn()

const mockRefreshCancellations = vi.fn()

const flaggedReview = {
  bookingId: 'r1',
  referenceNumber: 'REF-R1',
  currentStatus: 'flagged',
  facultyName: 'Dr. Maria Santos',
  facultyId: 'u1',
  department: 'Computer Science',
  departmentCode: 'BSCS',
  facility: { id: 'f1', name: 'Room 101', room_number: '101', floors: null },
  bookingDate: '2026-08-20',
  startTime: '09:00',
  endTime: '10:00',
  bookingPurpose: 'academic',
  facilityPurposeCategory: null,
  mismatchJustification: 'Room capacity exceeded',
  mismatchFlag: 'capacity',
  scoreBreakdown: null,
  submittedAt: '2026-08-15T08:00:00Z',
  alternativeFacilities: [],
  suggestedAlternative: null,
  reviewedBy: null,
}

const awaitingReview = {
  ...flaggedReview,
  bookingId: 'r2',
  referenceNumber: 'REF-R2',
  currentStatus: 'pending_faculty_response',
  facultyName: 'Engr. Jose Rizal',
}

const pendingBooking = {
  id: 'b1',
  referenceNumber: 'REF-B1',
  bookingDate: '2026-08-21',
  startTime: '13:00',
  endTime: '14:00',
  durationMinutes: 60,
  status: 'pending',
  bookingPurpose: 'academic',
  purpose: 'Lecture on Algorithms',
  eventName: null,
  expectedAttendees: 25,
  decisionScore: null,
  createdAt: '2026-08-14T10:00:00Z',
  mismatchFlag: null,
  courseCode: 'CS-210',
  courseDepartmentCode: 'BSCS',
  courseName: 'Algorithms',
  sessionType: 'lecture',
  facultyId: 'u3',
  facultyName: 'Prof. Ana Reyes',
  facultyEmail: 'ana@sti.edu.ph',
  departmentId: 'd1',
  department: 'Computer Science',
  departmentCode: 'BSCS',
  facilityId: 'f2',
  facilityName: 'Lab 2',
  roomNumber: '2',
  floorNumber: 2,
  buildingName: 'Main Building',
}

const cancellationRequest = {
  id: 'cr1',
  booking_id: 'b9',
  user_id: 'u9',
  reason: 'Event moved online',
  status: 'pending',
  original_status: 'confirmed',
  reviewed_by: null,
  reviewed_at: null,
  review_notes: null,
  auto_approved: false,
  refund_window_met: true,
  refund_destination_name: 'Jane Renter',
  refund_destination_contact_number: '09171234567',
  created_at: '2026-08-15T07:00:00Z',
  users: { full_name: 'Jane Renter', email: 'jane@example.com' },
  bookings: {
    booking_reference: 'REF-CR1',
    booking_date: '2026-08-22',
    start_time: '08:00:00',
    end_time: '10:00:00',
    current_status: 'confirmed',
    booking_facilities: [{ facility_id: 'fac-1', facilities: { name: 'Room 309' } }],
  },
}

let reviewsData: any[] = [flaggedReview, awaitingReview]
let requestsData: any[] = [cancellationRequest]
let pendingBookingsData: any[] = [pendingBooking]

vi.mock('@/hooks/academic-head/useMismatchReviews', () => ({
  useMismatchReviews: () => ({
    reviews: reviewsData,
    loading: false,
    submitting: null,
    submitReview: mockSubmitReview,
    refresh: mockRefreshReviews,
    batchApprove: mockBatchApprove,
    batchApproving: false,
  }),
}))

vi.mock('@/hooks/academic-head/useAcademicReservations', () => ({
  useAcademicReservations: () => ({
    bookings: [pendingBooking],
    departments: [{ id: 'd1', code: 'BSCS', name: 'Computer Science', activeBookings: 2 }],
    total: 1,
    totalPages: 1,
    page: 1,
    setPage: mockSetPage,
    loading: false,
    statusFilter: '',
    setStatusFilter: mockSetStatusFilter,
    fromDate: '',
    setFromDate: mockSetFromDate,
    toDate: '',
    setToDate: mockSetToDate,
    departmentId: '',
    setDepartmentId: mockSetDepartmentId,
    search: '',
    setSearch: mockSetSearch,
    sortBy: 'date_asc',
    setSortBy: mockSetSortBy,
    refresh: mockRefreshReservations,
    cancelBooking: mockCancelBooking,
    reviewBooking: mockReviewBooking,
    proposeChanges: mockProposeChanges,
    deleteBooking: mockDeleteBooking,
    bulkDeleteBookings: mockBulkDeleteBookings,
  }),
}))

vi.mock('@/hooks/academic-head/useCancellationRequests', () => ({
  useCancellationRequests: () => ({
    requests: requestsData,
    loading: false,
    responding: null,
    refresh: mockRefreshCancellations,
    respond: vi.fn(),
    setReviewNotes: vi.fn(),
    reviewNotes: {},
    pendingCount: requestsData.filter(r => r.status === 'pending').length,
    statusFilter: 'pending',
    setStatusFilter: vi.fn(),
    activeQrUrl: null,
    setActiveQrUrl: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// ---- Mocks for presentational components ----
vi.mock('@/app/academic/_components/ReservationInfoCard', () => ({
  ReservationInfoCard: (props: any) => (
    <div data-testid="reservation-card">
      <span data-testid="reservation-card-id">{props.booking?.id}</span>
      <span data-testid="reservation-card-has-review">{typeof props.onReview === 'function' ? 'yes' : 'no'}</span>
    </div>
  ),
  FacilityOption: {} as any,
}))

vi.mock('@/app/academic/_components/MismatchReviewCard', () => ({
  MismatchReviewCard: (props: any) => (
    <div data-testid="mismatch-card">
      <span data-testid="mismatch-card-id">{props.review?.bookingId}</span>
      <span data-testid="mismatch-card-selectable">{props.selectable ? 'yes' : 'no'}</span>
    </div>
  ),
}))

vi.mock('@/app/academic/_components/AcademicCalendar', () => ({
  AcademicCalendar: () => <div data-testid="academic-calendar" />,
}))

vi.mock('@/app/academic/_components/FixedClassSchedulesPreview', () => ({
  FixedClassSchedulesPreview: () => <div data-testid="fixed-schedules" />,
}))

vi.mock('@/components/shared/facilities/DashboardReviewBanner', () => ({
  DashboardReviewBanner: () => <div data-testid="review-banner" />,
}))

vi.mock('@/components/equipment/ReportEquipmentIssue', () => ({
  ReportEquipmentIssue: () => <div data-testid="report-equipment" />,
}))

vi.mock('@/app/academic/dashboard/_components/CancellationFocusCard', () => ({
  CancellationFocusCard: (props: any) => (
    <div data-testid="cancellation-focus">
      <span data-testid="cancellation-focus-id">{props.request?.id}</span>
    </div>
  ),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

function defaultFetch(url: string) {
  if (url.includes('/api/facilities')) {
    return Promise.resolve({ ok: true, json: async () => ({ facilities: [] }) })
  }
  if (url.includes('/api/schedules/my-classes')) {
    return Promise.resolve({ ok: true, json: async () => ({ classes: [] }) })
  }
  if (url.includes('/api/academic-head/reservations')) {
    return Promise.resolve({ ok: true, json: async () => ({ bookings: pendingBookingsData }) })
  }
  return Promise.resolve({ ok: true, json: async () => ({}) })
}

describe('AcademicHeadDashboard — Operator Console', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reviewsData = [flaggedReview, awaitingReview]
    requestsData = [cancellationRequest]
    pendingBookingsData = [pendingBooking]
    mockFetch.mockImplementation(defaultFetch as any)
  })

  it('renders one unified queue containing flagged reviews, pending reservations, and cancellations', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    const queue = screen.getByTestId('console-queue')
    expect(within(queue).getByText('Dr. Maria Santos')).toBeInTheDocument()
    expect(within(queue).getByText(/REF-B1/)).toBeInTheDocument()
    expect(within(queue).getByText('Jane Renter')).toBeInTheDocument()
  })

  it('ranks flagged reviews ahead of pending reservations and cancellations', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    const rows = screen.getAllByTestId('queue-row')
    const firstRow = within(rows[0])
    expect(firstRow.getByText('Dr. Maria Santos')).toBeInTheDocument()
    expect(rows.map(r => r.textContent).join(' | ')).toMatch(/Maria Santos[\s\S]*REF-B1[\s\S]*Jane Renter/)
  })

  it('labels every queue row state with icon and text, never color alone', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    expect(screen.getByText('Needs Review')).toBeInTheDocument()
    expect(screen.getByText('Awaiting Faculty')).toBeInTheDocument()
    expect(screen.getByText('Pending Approval')).toBeInTheDocument()
    expect(screen.getByText('Cancellation Request')).toBeInTheDocument()
  })

  it('filters the queue from the command search field', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    const input = screen.getByRole('searchbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'Maria' } })
    await waitFor(() => {
      const rows = screen.getAllByTestId('queue-row')
      expect(rows).toHaveLength(1)
      expect(within(rows[0]).getByText('Dr. Maria Santos')).toBeInTheDocument()
    })
  })

  it('renders the selected review row detail in the focus pane', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    const rows = screen.getAllByTestId('queue-row')
    fireEvent.click(within(rows[0]).getByTestId('queue-row-select'))
    await waitFor(() => {
      const pane = screen.getByTestId('focus-pane')
      expect(within(pane).getByTestId('mismatch-card-id')).toHaveTextContent('r1')
    })
  })

  it('renders the selected reservation row detail in the focus pane with review handlers', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    const rows = screen.getAllByTestId('queue-row')
    const reservationRow = rows.find(r => r.textContent?.includes('REF-B1'))
    fireEvent.click(within(reservationRow!).getByTestId('queue-row-select'))
    await waitFor(() => {
      const pane = screen.getByTestId('focus-pane')
      expect(within(pane).getByTestId('reservation-card-id')).toHaveTextContent('b1')
      expect(within(pane).getByTestId('reservation-card-has-review')).toHaveTextContent('yes')
    })
  })

  it('renders the selected cancellation row detail in the focus pane', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    const rows = screen.getAllByTestId('queue-row')
    const cancellationRow = rows.find(r => r.textContent?.includes('Jane Renter'))
    fireEvent.click(within(cancellationRow!).getByTestId('queue-row-select'))
    await waitFor(() => {
      const pane = screen.getByTestId('focus-pane')
      expect(within(pane).getByTestId('cancellation-focus-id')).toHaveTextContent('cr1')
    })
  })

  it('preserves the mismatch review flow: select-all-flagged and batch approve', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    const selectAll = screen.getByTestId('select-all-flagged')
    fireEvent.click(selectAll)
    const approveBtn = screen.getByTestId('batch-approve')
    expect(approveBtn).toHaveTextContent('Approve 1 selected')
    fireEvent.click(approveBtn)
    await waitFor(() => expect(mockBatchApprove).toHaveBeenCalledWith(['r1']))
  })

  it('shows a plain empty state when nothing needs attention', async () => {
    reviewsData = []
    requestsData = []
    pendingBookingsData = []
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-empty')).toBeInTheDocument())
    expect(screen.getByText(/nothing needs you/i)).toBeInTheDocument()
  })

  it('shows live counts in the verdict strip', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('verdict-strip')).toBeInTheDocument())
    expect(screen.getByTestId('verdict-awaiting-review')).toHaveTextContent('1')
    expect(screen.getByTestId('verdict-awaiting-faculty')).toHaveTextContent('1')
  })

  it('keeps the two-tone page title with the accent-brand highlight', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
    const h1 = screen.getByRole('heading', { level: 1 })
    const span = h1.querySelector('span.text-accent-brand')
    expect(span).not.toBeNull()
  })

  it('switches to the Directory view exposing the full reservations toolbar and calendar', async () => {
    const { default: Page } = await import('@/app/academic/dashboard/page')
    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('console-queue')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('view-directory'))
    await waitFor(() => {
      expect(screen.getByTestId('directory-toolbar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /calendar view/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /card view/i })).toBeInTheDocument()
    })
  })
})
