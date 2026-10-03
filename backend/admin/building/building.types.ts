/**
 * Building Admin Types
 *
 * Types for the building admin dashboard and its sub-pages.
 * Maps DB schema to frontend display shapes.
 */

// ─── Dashboard Stats ───
export interface DashboardStats {
  totalFacilities: number
  totalBookings: number
  todaysBookings: number
  roomUtilization: number
  activeUsers: number
  pendingApprovals: number
}

// ─── Facility Amenity ───
export interface FacilityAmenity {
  name: string
  displayName: string
  icon: string | null
  category: string
  quantity: number
  notes: string | null
}

/** Manual-editor input shape for BuildingFacilitiesService.syncManualAmenities() */
export interface ManualAmenityInput {
  name: string
  quantity: number
  notes?: string | null
}

/** A facility_amenities catalog entry, enriched with whether it is equipment-backed. */
export interface AmenityCatalogEntry {
  id: string
  name: string
  category: string | null
  icon: string | null
  /** True when some equipment_types row has amenity_id pointing at this amenity
   *  (i.e. it is owned/derived by the Phase 4 inventory-sync bridge, not manually set). */
  isEquipmentBacked: boolean
}

/** A facility_amenity_map row for a specific facility, enriched for the editor UI. */
export interface FacilityAmenityRow {
  amenityId: string
  name: string
  quantity: number
  notes: string | null
  source: 'manual' | 'inventory'
  isEquipmentBacked: boolean
}

/** Max length for a facility_amenities.name value entered via the manual editor. */
export const AMENITY_NAME_MAX_LENGTH = 100

/** Max length for facility_amenity_map.notes — shown as public brochure text, so capped
 *  to keep the brochure/spec-grid layout from blowing out. */
export const AMENITY_NOTES_MAX_LENGTH = 500

/** Max quantity for a single manually-entered amenity row — a sanity ceiling, not a real
 *  physical limit, so validateAmenityRows and the editor input both reject typos/abuse. */
export const AMENITY_QUANTITY_MAX = 9999

/**
 * Normalize an amenity name for case/format-insensitive comparison only (not for storage).
 * Strips whitespace, hyphens and underscores and lowercases, so "WiFi", "wifi", "Wi-Fi" and
 * "wi_fi" all collapse to the same comparison key and never spawn duplicate rows.
 */
export function normalizeAmenityName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** Humanize a stored amenity name (e.g. "air_conditioning" -> "Air Conditioning") for display. */
export function prettifyAmenityName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Whether an amenity editor row's quantity should be locked read-only.
 *
 * This is deliberately keyed on the row's *actual* `source` (does a
 * source='inventory' row already exist for this facility+amenity?), never on
 * `isEquipmentBacked` (does the amenity's catalog entry merely link to some
 * equipment_types row?). Those are different questions: most existing facilities
 * already have a `source='manual'` row for a catalog-linked amenity (e.g.
 * 'projector') — Phase 0 backfilled every pre-existing row, including the ones
 * the original facility-creation migration seeded per facility type — and that
 * row must stay admin-editable until Phase 4 actually claims it by writing its
 * own source='inventory' row. A row that doesn't exist yet at all (added fresh
 * via the "Add Amenity" combobox) is likewise never locked.
 */
export function isAmenityQuantityLocked(row: { hasExistingRow?: boolean; source?: string | null }): boolean {
  return !!row.hasExistingRow && row.source === 'inventory'
}

// ─── Facility Upcoming Booking ───
export interface FacilityUpcomingBooking {
  id: string
  title: string
  requesterName: string
  startTime: string
  endTime: string
  attendees: number | null
  source: 'booking' | 'class_schedule'
}

// ─── Facility ───
export interface BuildingFacility {
  id: string
  code: string
  name: string
  description: string | null
  floorId: string
  floorName: string
  floorNumber: number
  facilityTypeId: string
  facilityTypeName: string
  capacity: number
  areaSqm: number | null
  roomNumber: string | null
  isBookable: boolean
  requiresApproval: boolean
  status: string
  hourlyRate: number | null
  halfDayRate: number | null
  fullDayRate: number | null
  isAvailableForRental: boolean
  createdAt: string
  updatedAt: string
  // Live status (computed)
  currentActivity?: string
  currentUser?: string
  timeLeft?: string
  currentStartTime?: string
  currentEndTime?: string
  currentAttendees?: number | null
  todayUtilizationPct?: number
  amenities?: FacilityAmenity[]
  upcomingBookings?: FacilityUpcomingBooking[]
  nextAvailableTime?: string
  // Photos (cover photo falls back to the legacy singular image_url column)
  imageUrl?: string | null
  coverPhotoUrl?: string | null
  photoCount?: number
}

export interface BuildingFloor {
  id: string
  buildingId: string
  floorNumber: number
  name: string
  description: string | null
  isActive: boolean
}

// ─── Booking ───
export interface PendingRescheduleProposal {
  overrideId: string
  proposedDate: string
  proposedStartTime: string
  proposedEndTime: string
}

export interface BuildingBooking {
  id: string
  bookingReference: string
  userId: string
  requesterName: string
  requesterEmail: string
  bookingType: string
  bookingPurpose: string
  bookingDate: string
  startTime: string
  endTime: string
  purpose: string
  eventName: string | null
  expectedAttendees: number | null
  currentStatus: string
  requiresPayment: boolean
  paymentStatus: string | null
  submittedAt: string
  approvedAt: string | null
  rejectedAt: string | null
  facilities: { id: string; name: string; roomNumber: string | null }[]
  decisionScore: number | null
  oversightExpiresAt: string | null
  decisions: BookingDecision[]
  pendingReschedule?: PendingRescheduleProposal
  facilitatorName: string | null
  selfFacilitationConfirmed: boolean
  mismatchFlag: string | null
  mismatchJustification: string | null
  mismatchReviewedByName: string | null
  mismatchReviewedByRole: string | null
  courseCode: string | null
  courseName: string | null
  isElective: boolean
  electiveType: string | null
}

export interface BookingDecision {
  id: string
  hardConstraintsPassed: boolean
  hardConstraintFailedCode: string | null
  baseScore: number | null
  scoreAdjustments: any[] | null
  finalScore: number | null
  decision: string
  decisionReason: string | null
  pipelineVersion: string | null
  createdAt: string
}

// ─── Equipment ───
export interface BuildingEquipment {
  id: string
  equipmentCode: string
  equipmentName: string
  equipmentTypeId: string
  equipmentTypeName: string
  managedBy: 'pamo' | 'it' | 'building'
  currentStatusId: string
  currentStatusName: string
  assignedFacilityId: string | null
  assignedFacilityName: string | null
  serialNumber: string | null
  brand: string | null
  model: string | null
  purchaseDate: string | null
  warrantyExpiry: string | null
  notes: string | null
  isActive: boolean
}

// ─── Maintenance ───
export interface BuildingMaintenance {
  id: string
  type: 'facility' | 'equipment'
  targetId: string
  targetName: string
  scheduleDate: string
  completedDate: string | null
  technician: string
  status: string
  notes: string | null
  createdBy: string | null
  isActive: boolean
  createdAt: string
}

// ─── Calendar Event ───
export interface BuildingCalendarEvent {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  type: 'booking' | 'paid_reservation' | 'class_schedule' | 'maintenance' | 'event' | 'pending_event' | 'awaiting_reschedule'
  facilityName: string | null
  status?: string
  bookingType?: string
  bookerName?: string | null
}

// ─── Payment / Transaction ───
export interface BuildingTransaction {
  id: string
  paymentReference: string
  bookingId: string
  bookingReference: string
  userId: string
  userName: string
  amount: number
  currency: string
  paymentMethod: string
  paymentStatus: string
  facilityName: string
  bookingDate: string
  createdAt: string
  expiresAt: string | null
  qrReferenceNumber: string | null
  qrPayerName: string | null
  qrScreenshotUrl: string | null
  qrAccountName: string | null
  qrAccountNumber: string | null
  qrPayerAccountName: string | null
  qrPayerAccountNumber: string | null
}

// ─── Report Stats ───
export interface BuildingReportStats {
  totalBookings: number
  totalRevenue: number
  avgUtilization: number
  completionRate: number
}

// ─── Filters ───
export interface FacilityFilters {
  search?: string
  floor?: string
  type?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface BookingFilters {
  search?: string
  status?: string
  type?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface EquipmentFilters {
  search?: string
  category?: string
  status?: string
  page?: number
  pageSize?: number
  /** Restrict to equipment whose type has one of these managed_by scopes. */
  managedBy?: ('pamo' | 'it' | 'building')[]
  /** Restrict to equipment assigned to this facility. */
  facilityId?: string
  /** Filter by assignment state: 'assigned' (has facility), 'unassigned' (in storage). */
  assignment?: 'assigned' | 'unassigned'
}

export interface MaintenanceFilters {
  search?: string
  type?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface PaymentFilters {
  search?: string
  status?: string
  method?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

// ─── Search sanitization ───

/** Escape special characters in search input to prevent ilike injection */
export function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\]/g, (ch) => `\\${ch}`)
}

// ─── Transform helpers ───
export function dbFacilityToView(row: any): BuildingFacility {
  // Normalize status: DB stores lowercase ('available'), UI expects capitalized ('Available')
  const rawStatus: string = row.status || ''
  const status = rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1) : rawStatus

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    floorId: row.floor_id,
    floorName: row.floor?.name || '',
    floorNumber: row.floor?.floor_number || 0,
    facilityTypeId: row.facility_type_id,
    facilityTypeName: row.facility_type?.name || '',
    capacity: row.capacity,
    areaSqm: row.area_sqm,
    roomNumber: row.room_number,
    isBookable: row.is_bookable,
    requiresApproval: row.requires_approval,
    status,
    hourlyRate: row.hourly_rate,
    halfDayRate: row.half_day_rate,
    fullDayRate: row.full_day_rate,
    isAvailableForRental: row.is_available_for_rental,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Optional live status fields (only populated by getWithStatus)
    currentStartTime: row.currentStartTime,
    currentEndTime: row.currentEndTime,
    currentAttendees: row.currentAttendees,
    todayUtilizationPct: row.todayUtilizationPct,
    amenities: row.amenities,
    upcomingBookings: row.upcomingBookings,
    nextAvailableTime: row.nextAvailableTime,
    imageUrl: row.image_url ?? null,
    coverPhotoUrl: row.coverPhotoUrl ?? row.image_url ?? null,
    photoCount: row.photoCount,
  }
}

export function dbBookingToView(
  row: any,
  reviewerInfo?: { name: string; role: string } | null,
  courseInfo?: { course_name: string; is_elective: boolean; elective_type: string | null } | null
): BuildingBooking {
  const rescheduleOverrides: any[] = (row.booking_overrides || [])
    .filter((o: any) => o.override_action === 'emergency_reschedule')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const latestOverride = rescheduleOverrides[0]
  const pendingReschedule: PendingRescheduleProposal | undefined = latestOverride
    ? {
        overrideId: latestOverride.id,
        proposedDate: latestOverride.new_values?.booking_date ?? '',
        proposedStartTime: latestOverride.new_values?.start_time ?? '',
        proposedEndTime: latestOverride.new_values?.end_time ?? '',
      }
    : undefined

  return {
    id: row.id,
    bookingReference: row.booking_reference,
    userId: row.user_id,
    requesterName: row.user?.full_name || 'Unknown',
    requesterEmail: row.user?.email || '',
    bookingType: row.booking_type,
    bookingPurpose: row.booking_purpose,
    bookingDate: row.booking_date,
    startTime: row.start_time,
    endTime: row.end_time,
    purpose: row.purpose,
    eventName: row.event_name,
    expectedAttendees: row.expected_attendees,
    currentStatus: row.current_status,
    requiresPayment: row.requires_payment,
    paymentStatus: row.payment_status || null,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    facilities: (row.booking_facilities || []).map((bf: any) => ({
      id: bf.facility?.id || bf.facility_id,
      name: bf.facility?.name || '',
      roomNumber: bf.facility?.room_number || null,
    })),
    decisionScore: row.decision_score ?? null,
    oversightExpiresAt: row.oversight_expires_at ?? null,
    decisions: (row.booking_decisions || []).map((d: any) => ({
      id: d.id,
      hardConstraintsPassed: d.hard_constraints_passed,
      hardConstraintFailedCode: d.hard_constraint_failed_code,
      baseScore: d.base_score,
      scoreAdjustments: d.score_adjustments,
      finalScore: d.final_score,
      decision: d.decision,
      decisionReason: d.decision_reason,
      pipelineVersion: d.pipeline_version,
      createdAt: d.created_at,
    })),
    pendingReschedule,
    facilitatorName: row.facilitator_name ?? null,
    selfFacilitationConfirmed: row.self_facilitation_confirmed ?? false,
    mismatchFlag: row.mismatch_flag ?? null,
    mismatchJustification: row.mismatch_justification ?? null,
    mismatchReviewedByName: reviewerInfo?.name ?? null,
    mismatchReviewedByRole: reviewerInfo?.role ?? null,
    courseCode: row.booking_course_code ?? null,
    courseName: courseInfo?.course_name ?? null,
    isElective: courseInfo?.is_elective ?? false,
    electiveType: courseInfo?.elective_type ?? null,
  }
}

export function dbEquipmentToView(row: any): BuildingEquipment {
  return {
    id: row.id,
    equipmentCode: row.equipment_code,
    equipmentName: row.equipment_name,
    equipmentTypeId: row.equipment_type_id,
    equipmentTypeName: row.equipment_type?.name || '',
    managedBy: row.equipment_type?.managed_by || 'pamo',
    currentStatusId: row.current_status_id,
    currentStatusName: row.equipment_status_type?.name || row.status_type?.name || '',
    assignedFacilityId: row.assigned_facility_id,
    assignedFacilityName: row.facility?.name || null,
    serialNumber: row.serial_number,
    brand: row.brand,
    model: row.model,
    purchaseDate: row.purchase_date,
    warrantyExpiry: row.warranty_expiry,
    notes: row.notes,
    isActive: row.is_active,
  }
}

export function dbMaintenanceToView(row: any): BuildingMaintenance {
  return {
    id: row.id,
    type: row.type,
    targetId: row.target_id,
    targetName: row.target_name,
    scheduleDate: row.schedule_date,
    completedDate: row.completed_date,
    technician: row.technician,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function dbTransactionToView(row: any): BuildingTransaction {
  return {
    id: row.id,
    paymentReference: row.payment_reference,
    bookingId: row.booking_id,
    bookingReference: row.booking?.booking_reference || '',
    userId: row.user_id,
    userName: row.user?.full_name || 'Unknown',
    amount: Number(row.amount) || 0,
    currency: row.currency || 'PHP',
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    facilityName: row.booking?.booking_facilities?.[0]?.facility?.name || '',
    bookingDate: row.booking?.booking_date || '',
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? null,
    qrReferenceNumber: row.qr_reference_number ?? null,
    qrPayerName: row.qr_payer_name ?? null,
    qrScreenshotUrl: row.qr_screenshot_url ?? null,
    qrAccountName: row.qr_code?.account_name ?? null,
    qrAccountNumber: row.qr_code?.account_number ?? null,
    qrPayerAccountName: row.qr_payer_account_name ?? null,
    qrPayerAccountNumber: row.qr_payer_account_number ?? null,
  }
}

// ─── Directory ───

export type PersonCategory =
  | 'faculty'
  | 'program_head'
  | 'academic_head'
  | 'building_admin'
  | 'cashier'
  | 'it_admin'
  | 'external_client'
  | 'maintenance_staff'

export interface DirectoryPerson {
  id: string
  source: 'users' | 'maintenance_staff'
  category: PersonCategory
  name: string
  email: string | null
  phone: string | null
  employeeId: string | null
  departmentId: string | null
  departmentName: string | null
  departmentCode: string | null
  position: string | null
  organizationName: string | null
  organizationType: string | null
  isActive: boolean
  isVerified: boolean | null
  isBlacklisted: boolean | null
  lastActivityAt: string | null
  avatarUrl: string | null
  roles: string[]
}

export interface MaintenanceStaffMember {
  id: string
  employeeId: string
  fullName: string
  email: string | null
  phone: string | null
  position: string
  specialization: string | null
  hireDate: string | null
  isActive: boolean
  notes: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  assignedFacilities?: FacilityAssignmentSummary[]
}

export interface FacilityAssignmentSummary {
  assignmentId: string
  facilityId: string
  facilityName: string
  facilityCode: string
  facilityRoomNumber: string | null
  assignedAt: string
  isActive: boolean
}

export interface DirectoryPersonDetail extends DirectoryPerson {
  // extra fields for external clients
  contactPerson: string | null
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  city: string | null
  province: string | null
  trustScore: number | null
  verifiedAt: string | null
  verificationNotes: string | null
  blacklistReason: string | null
  // for maintenance staff
  specialization: string | null
  hireDate: string | null
  notes: string | null
  assignedFacilities?: FacilityAssignmentSummary[]
}

export interface DirectoryBooking {
  id: string
  bookingReference: string
  bookingDate: string
  startTime: string
  endTime: string
  purpose: string
  eventName: string | null
  currentStatus: string
  requiresPayment: boolean
  paymentStatus: string | null
  facilities: string[]
  submittedAt: string
  courseCode: string | null
  courseName: string | null
  isElective: boolean
  electiveType: string | null
}

export interface DirectoryPayment {
  id: string
  paymentReference: string
  amount: number
  totalAmount: number
  currency: string
  paymentMethod: string
  paymentStatus: string
  bookingReference: string
  paidAt: string | null
  createdAt: string
}

export interface DirectorySchedule {
  id: string
  courseCode: string
  courseName: string
  section: string
  dayOfWeek: number
  startTime: string
  endTime: string
  facilityName: string | null
  facilityCode: string | null
  roomNumber: string | null
}

export interface DirectoryFilters {
  search?: string
  category?: PersonCategory | 'all'
  departmentId?: string
  status?: 'active' | 'inactive' | 'all'
  sortBy?: 'name' | 'category' | 'department' | 'status' | 'lastActivity'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export function dbMaintenanceStaffToView(row: any): MaintenanceStaffMember {
  return {
    id: row.id,
    employeeId: row.employee_id,
    fullName: row.full_name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    position: row.position ?? 'Maintenance Technician',
    specialization: row.specialization ?? null,
    hireDate: row.hire_date ?? null,
    isActive: row.is_active,
    notes: row.notes ?? null,
    avatarUrl: row.avatar_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedFacilities: (row.facility_maintenance_assignments ?? []).map(dbFmaToSummary),
  }
}

export function dbFmaToSummary(row: any): FacilityAssignmentSummary {
  return {
    assignmentId: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility?.name ?? '',
    facilityCode: row.facility?.code ?? '',
    facilityRoomNumber: row.facility?.room_number ?? null,
    assignedAt: row.assigned_at,
    isActive: row.is_active,
  }
}

// ─── Settings / Preferences ───

export interface ProfileUpdateData {
  fullName?: string
  phone?: string
  notificationEmail?: string
  gender?: string
  language?: string
}

export interface NotificationPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  bookingAlerts: boolean
  scheduleAlerts: boolean
  systemAlerts: boolean
}

export interface LocalePreferences {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: '12h' | '24h'
}

export interface AppearancePreferences {
  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
  sidebarCollapsed: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  bookingAlerts: true,
  scheduleAlerts: true,
  systemAlerts: true,
}

export const DEFAULT_LOCALE_PREFS: LocalePreferences = {
  language: 'en',
  timezone: 'Asia/Manila',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
}

export const DEFAULT_APPEARANCE_PREFS: AppearancePreferences = {
  theme: 'system',
  compactMode: false,
  sidebarCollapsed: false,
}

// ─── Rental Rates ───

export type FeeCategory = 'rental' | 'energy' | 'personnel'
export type RateType = 'hourly' | 'flat' | 'variable'
export type TimePeriod = 'am' | 'pm' | 'all_day'

export interface RentalRate {
  id: string
  facilityId: string
  facilityName?: string
  feeCategory: FeeCategory
  rateName: string
  rateType: RateType
  timePeriod: TimePeriod
  amount: number
  currency: string
  applicableStartTime: string | null
  applicableEndTime: string | null
  description: string | null
  isRequired: boolean
  isAddon: boolean
  sortOrder: number
  isActive: boolean
  effectiveFrom: string
  effectiveUntil: string | null
  createdAt: string
  updatedAt: string
}

export interface FacilityRates {
  facilityId: string
  facilityName: string
  amRate: number | null
  pmRate: number | null
  amCutoffHour: number
  addons: {
    id: string
    name: string
    amount: number
    isAddon: true
  }[]
  rawRates: RentalRate[]
}

export interface RentalRateFilters {
  facilityId?: string
  isAddon?: boolean
  isActive?: boolean
  feeCategory?: FeeCategory
}

export interface CreateRateInput {
  facilityId: string
  feeCategory: FeeCategory
  rateName: string
  rateType: RateType
  timePeriod: TimePeriod
  amount: number
  applicableStartTime?: string
  applicableEndTime?: string
  description?: string
  isRequired?: boolean
  isAddon?: boolean
  sortOrder?: number
}

// ─── Facility Warnings ───

export type WarningSeverity = 'info' | 'warning' | 'critical'

export interface FacilityWarning {
  id: string
  facilityId: string
  severity: WarningSeverity
  message: string
  isActive: boolean
  createdBy: string | null
  createdByName?: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export function dbWarningToView(row: any): FacilityWarning {
  return {
    id: row.id,
    facilityId: row.facility_id,
    severity: row.severity,
    message: row.message,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdByName: row.created_by_user?.full_name ?? null,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Facility Reviews ───

export type IssueCategory =
  | 'EQUIPMENT' | 'AIRCON' | 'LIGHTING' | 'CLEANLINESS' | 'NETWORK' | 'FURNITURE' | 'SAFETY' | 'OTHER'

export type ReviewStatus = 'published' | 'under_review' | 'archived'

export interface FacilityReview {
  id: string
  facilityId: string
  facilityName?: string
  userId: string
  userName?: string
  bookingId: string | null
  rating: number
  comment: string | null
  issueReported: boolean
  issueCategory: IssueCategory | null
  status: ReviewStatus
  createdAt: string
}

export function dbReviewToView(row: any): FacilityReview {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility?.name,
    userId: row.user_id,
    userName: row.user?.full_name ?? 'Unknown',
    bookingId: row.booking_id,
    rating: row.rating,
    comment: row.comment,
    issueReported: row.issue_reported,
    issueCategory: row.issue_category,
    status: row.status,
    createdAt: row.created_at,
  }
}

export interface ReviewFilters {
  facilityId?: string
  rating?: number
  status?: ReviewStatus
  hasIssue?: boolean
  page?: number
  pageSize?: number
}

// ─── Facility Photos ───

export interface FacilityPhoto {
  id: string
  facilityId: string
  storagePath: string
  publicUrl: string
  caption: string | null
  isCover: boolean
  sortOrder: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export function dbPhotoToView(row: any): FacilityPhoto {
  return {
    id: row.id,
    facilityId: row.facility_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    caption: row.caption,
    isCover: row.is_cover,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Facility Issue Reports ───

export type IssueReportStatus = 'open' | 'converted' | 'dismissed'

export interface FacilityIssueReport {
  id: string
  facilityId: string
  facilityName?: string
  reviewId: string | null
  reportedBy: string | null
  reportedByName?: string | null
  category: IssueCategory
  details: string | null
  status: IssueReportStatus
  maintenanceRecordId: string | null
  createdAt: string
  updatedAt: string
}

export function dbIssueReportToView(row: any): FacilityIssueReport {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility?.name,
    reviewId: row.review_id,
    reportedBy: row.reported_by,
    reportedByName: row.reported_by_user?.full_name ?? null,
    category: row.category,
    details: row.details,
    status: row.status,
    maintenanceRecordId: row.maintenance_record_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function dbRentalRateToView(row: any, facilityName?: string): RentalRate {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: facilityName ?? row.facilities?.name ?? undefined,
    feeCategory: row.fee_category,
    rateName: row.rate_name,
    rateType: row.rate_type,
    timePeriod: row.time_period,
    amount: Number(row.amount),
    currency: row.currency || 'PHP',
    applicableStartTime: row.applicable_start_time ?? null,
    applicableEndTime: row.applicable_end_time ?? null,
    description: row.description ?? null,
    isRequired: row.is_required,
    isAddon: row.is_addon,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
