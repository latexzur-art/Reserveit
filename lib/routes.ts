/**
 * Canonical route constants for ReserveIT.
 *
 * Single source of truth for page URLs per role, post-login landing pages
 * (ROLE_HOME), middleware route guards, and the inconsistently-named API
 * groups. Importable from middleware, app pages, components, hooks, backend
 * (email link builders), and tests without creating cycles.
 *
 * NOTE: These constants reflect the URLs as they exist today. Phases 3 and 6
 * of the per-role refactor flatten /faculty/faculty and
 * /program/programhead/programhead — when that happens, only this file (and
 * the legacy redirects) should need to change.
 */

export const ROUTES = {
  public: {
    landing: '/',
    login: '/login',
    signup: '/signup',
    clientLogin: '/client/login',
    authCallback: '/auth/callback',
    verifyEmail: '/auth/verify-email',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    changePassword: '/auth/change-password',
    unauthorized: '/unauthorized',
  },

  userManager: {
    root: '/admin/users',
    home: '/admin/users',
    equipment: '/admin/users/equipment',
    equipmentReports: '/admin/users/equipment/reports',
    equipmentRequests: '/admin/users/equipment/requests',
    notifications: '/admin/users/notifications',
  },

  // PAMO (Purchasing and Asset Management Officer) — non-tech equipment inventory.
  pamo: {
    root: '/admin/pamo',
    home: '/admin/pamo',
    equipment: '/admin/pamo/equipment',
    reports: '/admin/pamo/reports',
    notifications: '/admin/pamo/notifications',
  },

  buildingAdmin: {
    root: '/admin/building',
    home: '/admin/building',
    calendar: '/admin/building/calendar',
    directory: '/admin/building/directory',
    equipment: '/admin/building/equipment',
    equipmentHvac: '/admin/building/equipment/hvac',
    equipmentReports: '/admin/building/equipment/reports',
    equipmentRequests: '/admin/building/equipment/requests',
    facilityManagement: '/admin/building/facility-management',
    facilities: '/admin/building/facilities',
    faq: '/admin/building/faq',
    maintenanceLogs: '/admin/building/logs/maintenance',
    paymentLogs: '/admin/building/logs/payments',
    messages: '/admin/building/messages',
    notifications: '/admin/building/notifications',
    payment: '/admin/building/payment',
    paymentManagement: '/admin/building/payment-management',
    pricing: '/admin/building/pricing',
    reports: '/admin/building/reports',
    reservations: '/admin/building/reservations',
    reserve: '/admin/building/reserve',
    restrictedUsers: '/admin/building/restricted-users',
    roomAvailability: '/admin/building/room-availability',
    schoolEvents: '/admin/building/school-events',
    settings: '/admin/building/settings',
  },

  academic: {
    root: '/academic',
    home: '/academic/dashboard',
    dashboard: '/academic/dashboard',
    curriculum: '/academic/curriculum',
    curriculumApprovalQueue: '/academic/curriculum/approval-queue',
    curriculumCourseCatalog: '/academic/curriculum/course-catalog',
    curriculumUploadHistory: '/academic/curriculum/upload-history',
    academicSections: '/academic/sections',
    departments: '/academic/departments',
    departmentsReliability: '/academic/departments/reliability',
    facilities: '/academic/facilities',
    history: '/academic/history',
    messages: '/academic/messages',
    myReservations: '/academic/my-reservations',
    mySchedules: '/academic/my-schedules',
    notifications: '/academic/notifications',
    payment: '/academic/payment',
    reservations: '/academic/reservations',
    reserve: '/academic/reserve',
    schedulesAliases: '/academic/schedules/aliases',
    schedulesAll: '/academic/schedules/all',
    schedulesAssignments: '/academic/schedules/assignments',
    schedulesCalendar: '/academic/schedules/calendar',
    schedulesChangeRequests: '/academic/schedules/change-requests',
    schedulesEnrollment: '/academic/schedules/enrollment',
    schedulesEvents: '/academic/schedules/events',
    schedulesHistory: '/academic/schedules/history',
    schedulesReview: '/academic/schedules/review',
    schedulesReviewUpload: (uploadId: string) => `/academic/schedules/review/${uploadId}`,
    schedulesTerms: '/academic/schedules/terms',
    schedulesUploads: '/academic/schedules/uploads',
    settings: '/academic/settings',
    specialEventsQueue: '/academic/special-events/queue',
  },

  // Flattened from the legacy /program/programhead/programhead/* tree in
  // Phase 6. The legacy tree was removed outright (owner decision, mirrors
  // the Phase-3 faculty flatten) — no redirects.
  program: {
    root: '/program',
    home: '/program/dashboard',
    dashboard: '/program/dashboard',
    approvedSchedules: '/program/approved-schedules',
    calendar: '/program/calendar',
    courses: '/program/courses',
    curriculum: '/program/curriculum',
    form: '/program/form',
    history: '/program/history',
    notifications: '/program/notifications',
    payment: '/program/payment',
    profile: '/program/profile',
    requests: '/program/requests',
    reservations: '/program/reservations',
    scheduleManagement: '/program/schedule-management',
    schedules: '/program/schedules',
    schedulesReviewUpload: (uploadId: string) => `/program/schedules/review/${uploadId}`,
    schedulesUploads: '/program/schedules/uploads',
    schedulesAssignments: '/program/schedules/assignments',
    schoolEvents: '/program/school-events',
    programSections: '/program/sections',
  },

  // Flattened from the legacy /faculty/faculty/* tree in Phase 3. The legacy
  // tree was removed outright (owner decision, 2026-06-12) — no redirects.
  faculty: {
    root: '/faculty',
    home: '/faculty/dashboard',
    dashboard: '/faculty/dashboard',
    calendar: '/faculty/calendar',
    form: '/faculty/form',
    notifications: '/faculty/notifications',
    payment: '/faculty/payment',
    profile: '/faculty/profile',
    requests: '/faculty/requests',
    reservations: '/faculty/reservations',
    schedules: '/faculty/schedules',
  },

  client: {
    root: '/client',
    home: '/client/dashboard',
    dashboard: '/client/dashboard',
    booking: '/client/booking',
    bookings: '/client/bookings',
    calendar: '/client/calendar',
    facilities: '/client/facilities',
    credits: '/client/credits',
    login: '/client/login',
    notifications: '/client/notifications',
    payment: '/client/payment',
    profile: '/client/profile',
  },

  internal: {
    root: '/internal',
    personalGymBooking: '/internal/personal-gym-booking',
  },
} as const

/**
 * Client-side helper: returns the role-appropriate bookings URL from a user's
 * roles array (no DB call). Mirrors the priority order in
 * backend/notifications/recipientResolver#resolveUserPageUrls.
 */
export function getBookingsUrlForRoles(roles: { name: string }[]): string {
  const names = roles.map(r => r.name)
  if (names.includes('faculty')) return ROUTES.faculty.reservations
  if (names.includes('program_head')) return ROUTES.program.reservations
  if (names.includes('academic_head')) return ROUTES.academic.myReservations
  return ROUTES.client.bookings
}

/**
 * Post-login landing page per role. Consumed by
 * backend/auth/auth.utils.ts:getDefaultRoute (and via it the auth callback,
 * auth.service, and auth.client).
 */
export const ROLE_HOME: Record<string, string> = {
  it_admin: ROUTES.userManager.home,
  pamo_officer: ROUTES.pamo.home,
  building_admin: ROUTES.buildingAdmin.home,
  academic_head: ROUTES.academic.home,
  program_head: ROUTES.program.home,
  faculty: ROUTES.faculty.home,
  external_client: ROUTES.client.home,
}

/** Public routes (no auth) — consumed by middleware.ts. Order preserved. */
export const PUBLIC_PAGE_ROUTES: string[] = [
  ROUTES.public.landing,
  ROUTES.public.login,
  ROUTES.public.signup,
  ROUTES.public.clientLogin,
  ROUTES.public.authCallback,
  ROUTES.public.verifyEmail,
  ROUTES.public.forgotPassword,
  ROUTES.public.resetPassword,
  ROUTES.public.changePassword,
  ROUTES.public.unauthorized,
  '/api', // API routes handle their own auth
]

/** Route-prefix → required roles — consumed by middleware.ts. Order matters: first prefix match wins. */
export const ROUTE_ROLE_MAP: Record<string, string[]> = {
  [ROUTES.userManager.root]: ['it_admin'],
  [ROUTES.pamo.root]: ['pamo_officer'],
  [ROUTES.buildingAdmin.root]: ['building_admin'],
  [ROUTES.academic.root]: ['academic_head'],
  [ROUTES.program.root]: ['program_head'],
  [ROUTES.faculty.root]: ['faculty'],
  [ROUTES.internal.root]: ['faculty', 'program_head', 'academic_head'],
  [ROUTES.client.root]: ['external_client'],
  '/reservations': ['faculty', 'program_head', 'academic_head', 'building_admin', 'external_client'],
}


/**
 * API path constants for the inconsistently-named route groups. The folders
 * themselves are intentionally NOT renamed (out of refactor scope) — these
 * constants document and centralize the divergence.
 */
export const API_ROUTES = {
  academicHead: '/api/academic-head',
  academicScheduleEvents: '/api/academic-head/schedule-events',
  academicScheduleExceptions: '/api/academic-head/schedule-exceptions',
  programScheduleEvents: '/api/program-head/schedule-events',
  programCourseSubmissions: '/api/program-head/course-submissions',
} as const
