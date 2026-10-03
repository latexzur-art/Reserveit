/**
 * Centralized enum-to-human-readable label mapping.
 *
 * Every DB enum value that surfaces in the UI should go through `labelFor()` or
 * `formatEnumLabel()`.  The per-enum overrides in ENUM_LABELS take priority;
 * anything not listed there falls back to the generic snake_case → Title Case
 * converter.
 */

// ---------------------------------------------------------------------------
// Generic formatter: snake_case / kebab-case → Title Case
// ---------------------------------------------------------------------------

export function formatEnumLabel(value?: string | null): string {
  if (!value) return '—'
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase split
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Per-enum overrides  (only entries that need something better than the
// generic Title Case result)
// ---------------------------------------------------------------------------

const ENUM_LABELS: Record<string, Record<string, string>> = {
  // ── Booking ───────────────────────────────────────────────────────────────
  booking_status: {
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
    auto_approved: 'Auto-Approved',
    auto_declined: 'Auto-Declined',
    flagged: 'Under Review',
    overridden: 'Overridden',
    pending_faculty_response: 'Pending Faculty Response',
    pending_user_response: 'Action Required',
    on_hold: 'On Hold',
    cancellation_requested: 'Cancellation Requested',
    cancellation_proposed: 'Cancellation Proposed',
    awaiting_reschedule: 'Awaiting Reschedule',
  },

  booking_type: {
    internal_free: 'Internal (Free)',
    internal_paid: 'Internal (Paid)',
    external_paid: 'External (Paid)',
    school_event_block: 'School Event Block',
  },

  booking_purpose: {
    academic: 'Academic',
    school_event: 'School Event',
    department_use: 'Department Use',
    personal: 'Personal',
    commercial: 'Commercial',
    community: 'Community',
  },

  // ── Payment ───────────────────────────────────────────────────────────────
  payment_status: {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    pending_review: 'Pending Review',
    refund_requested: 'Refund Requested',
    refund_processing: 'Awaiting Confirmation',
  },

  payment_method: {
    paymongo_card: 'Credit/Debit Card',
    paymongo_gcash: 'GCash',
    paymongo_grab: 'GrabPay',
    paymongo_maya: 'Maya',
    cashier: 'Cash (Cashier)',
    qr_manual: 'QR Manual',
    session_credits: 'Session Credits',
    credits: 'Session Credits',
  },

  payment_type: {
    booking: 'Booking',
    extension: 'Extension',
    reschedule_extra: 'Reschedule Extra',
  },

  // ── User / Auth ───────────────────────────────────────────────────────────
  account_status: {
    pending: 'Pending',
    active: 'Active',
    suspended: 'Suspended',
    inactive: 'Inactive',
    restricted: 'Restricted',
    probation: 'Probation',
  },

  user_role: {
    it_admin: 'IT Admin',
    building_admin: 'Building Admin',
    academic_head: 'Academic Head',
    program_head: 'Program Head',
    faculty: 'Faculty',
    external_client: 'External Client',
    pamo_officer: 'PAMO Officer',
    pamo: 'PAMO',
  },

  user_type: {
    internal: 'Internal',
    external: 'External',
  },

  // ── Schedule / Upload ─────────────────────────────────────────────────────
  upload_status: {
    draft: 'Draft',
    parsing: 'Parsing',
    parsed: 'Parsed',
    validation_failed: 'Validation Failed',
    validating: 'Validating',
    validated: 'Validated',
    pending_submission: 'Pending Submission',
    pending_review: 'Pending Review',
    under_review: 'Under Review',
    submitted: 'Submitted',
    revision_requested: 'Revision Requested',
    approved: 'Approved',
    partially_approved: 'Partially Approved',
    partially_rejected: 'Partially Rejected',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    deleted: 'Deleted',
  },

  upload_mode: {
    file_upload: 'File Upload',
    manual_entry: 'Manual Entry',
    hybrid: 'Hybrid',
    grid_entry: 'Grid Entry',
  },

  validation_status: {
    pending: 'Pending',
    valid: 'Valid',
    warning: 'Warning',
    error: 'Error',
  },

  dean_review_status: {
    pending_review: 'Pending Review',
    dean_approved: 'Dean Approved',
    dean_flagged: 'Dean Flagged',
    dean_rejected: 'Dean Rejected',
  },

  // ── Academic ──────────────────────────────────────────────────────────────
  term_type: {
    first_semester: 'First Semester',
    second_semester: 'Second Semester',
    summer: 'Summer',
    midyear: 'Midyear',
  },

  delivery_mode: {
    lecture: 'Lecture',
    lab: 'Lab',
    both: 'Lecture & Lab',
    practicum: 'Practicum',
  },

  approval_status: {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    sent_back: 'Sent Back',
  },

  activation_method: {
    auto: 'Auto',
    manual_override: 'Manual Override',
  },

  // ── Facility ──────────────────────────────────────────────────────────────
  facility_status: {
    available: 'Available',
    maintenance: 'Maintenance',
    unavailable: 'Unavailable',
    reserved: 'Reserved',
  },

  facility_tier: {
    standard: 'Standard',
    premium: 'Premium',
    specialized: 'Specialized',
  },

  block_type: {
    admin_block: 'Admin Block',
    maintenance: 'Maintenance',
    event_hold: 'Event Hold',
    enrollment: 'Enrollment',
  },

  // ── Equipment ─────────────────────────────────────────────────────────────
  equipment_report_status: {
    open: 'Open',
    under_process: 'Under Process',
    resolved: 'Resolved',
    still_broken: 'Still Broken',
    escalated: 'Escalated',
  },

  equipment_report_category: {
    broken: 'Broken',
    missing: 'Missing',
    malfunction: 'Malfunction',
    other: 'Other',
  },

  equipment_request_status: {
    pending: 'Pending',
    approved: 'Approved',
    in_progress: 'In Progress',
    completed: 'Completed',
    rejected: 'Rejected',
  },

  managed_by: {
    pamo: 'PAMO',
    it: 'IT',
    building: 'Building',
  },

  // ── Maintenance ───────────────────────────────────────────────────────────
  maintenance_type: {
    facility: 'Facility',
    equipment: 'Equipment',
  },

  maintenance_status: {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },

  // ── Cancellation / Emergency ──────────────────────────────────────────────
  cancellation_type: {
    user_cancelled: 'User Cancelled',
    admin_cancelled: 'Admin Cancelled',
    facility_unavailable: 'Facility Unavailable',
    schedule_conflict: 'Schedule Conflict',
    payment_timeout: 'Payment Timeout',
    force_majeure: 'Force Majeure',
    alternative_declined: 'Alternative Declined',
    cancellation_approved: 'Cancellation Approved',
  },

  cancellation_request_status: {
    pending: 'Pending',
    approved_no_strike: 'Approved (No Strike)',
    approved_with_strike: 'Approved (With Strike)',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    auto_approved: 'Auto-Approved',
  },

  emergency_request_status: {
    pending: 'Pending',
    approved: 'Approved',
    denied: 'Denied',
    withdrawn: 'Withdrawn',
    pending_extra_payment: 'Awaiting Payment',
    completed: 'Completed',
    declined: 'Declined',
  },

  // ── Event Approval ────────────────────────────────────────────────────────
  event_approval_status: {
    pending: 'Pending',
    approved: 'Approved',
    declined: 'Declined',
  },

  // ── Reschedule ────────────────────────────────────────────────────────────
  reschedule_offer_status: {
    pending: 'Pending',
    rescheduled: 'Rescheduled',
    expired: 'Expired',
    cancelled: 'Cancelled',
  },

  // ── Scoring / Restrictions ────────────────────────────────────────────────
  restriction_action: {
    auto_restricted: 'Auto Restricted',
    manually_restricted: 'Manually Restricted',
    restriction_lifted: 'Restriction Lifted',
    restriction_extended: 'Restriction Extended',
    probation_started: 'Probation Started',
    probation_ended: 'Probation Ended',
    score_reset: 'Score Reset',
    score_reset_bulk: 'Score Reset (Bulk)',
  },

  score_reset_request_status: {
    pending: 'Pending',
    approved: 'Approved',
    declined: 'Declined',
  },

  reset_type: {
    consecutive: 'Consecutive',
    cancellation_rate: 'Cancellation Rate',
  },

  // ── Credits ───────────────────────────────────────────────────────────────
  credit_event_type: {
    issued: 'Issued',
    applied: 'Applied',
    expired: 'Expired',
    voided: 'Voided',
  },

  credit_source: {
    force_majeure: 'Force Majeure',
    alternative_declined: 'Alternative Declined',
    admin_manual: 'Admin Manual',
    checkout_application: 'Checkout Application',
  },

  // ── Assignments ───────────────────────────────────────────────────────────
  assignment_lineup_status: {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    partially_approved: 'Partially Approved',
  },

  assignment_item_status: {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    conflict: 'Conflict',
  },

  // ── Refunds ───────────────────────────────────────────────────────────────
  refund_trigger_type: {
    cancellation_request_entitlement: 'Cancellation Entitlement',
    ba_override: 'BA Override',
  },

  refund_method_type: {
    manual: 'Manual',
    paymongo_api: 'PayMongo API',
  },

  // ── Issue Reports ─────────────────────────────────────────────────────────
  facility_issue_category: {
    not_as_described: 'Not As Described',
    cleanliness: 'Cleanliness',
    equipment_broken: 'Equipment Broken',
    safety: 'Safety',
    noise: 'Noise',
    other: 'Other',
  },

  facility_issue_status: {
    open: 'Open',
    converted: 'Converted',
    dismissed: 'Dismissed',
  },

  facility_review_status: {
    published: 'Published',
    under_review: 'Under Review',
    archived: 'Archived',
  },

  warning_severity: {
    info: 'Info',
    warning: 'Warning',
    critical: 'Critical',
  },

  // ── Schedule Issue Reports ────────────────────────────────────────────────
  schedule_issue_category: {
    wrong_room: 'Wrong Room',
    time_conflict: 'Time Conflict',
    missing_session: 'Missing Session',
    incorrect_time: 'Incorrect Time',
    instructor_mismatch: 'Instructor Mismatch',
    not_updated: 'Not Updated',
    equipment_issue: 'Equipment Issue',
    other: 'Other',
  },

  schedule_issue_status: {
    pending: 'Pending',
    under_review: 'Under Review',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
    escalated: 'Escalated',
  },

  schedule_type: {
    class: 'Class',
    reservation: 'Reservation',
  },

  escalated_to: {
    it_admin: 'IT Admin',
    pamo: 'PAMO',
  },

  // ── Messaging ─────────────────────────────────────────────────────────────
  notification_type: {
    info: 'Info',
    warning: 'Warning',
    success: 'Success',
    error: 'Error',
  },

  message_status: {
    draft: 'Draft',
    scheduled: 'Scheduled',
    sent: 'Sent',
  },

  send_as: {
    email: 'Email',
    'in-app': 'In-App',
    both: 'Both',
  },

  target_audience: {
    all: 'All',
    internal: 'Internal',
    external: 'External',
    admins: 'Admins',
  },

  // ── Scheduling constraints ────────────────────────────────────────────────
  change_type: {
    modify: 'Modify',
    cancel: 'Cancel',
    add: 'Add',
  },

  change_request_status: {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  },

  override_action: {
    cancel: 'Cancel',
    reschedule: 'Reschedule',
    change_facility: 'Change Facility',
    emergency_reschedule: 'Reschedule',
  },

  constraint_type: {
    hard: 'Hard',
    soft: 'Soft',
  },

  constraint_category: {
    requester: 'Requester',
    booking: 'Booking',
    facility: 'Facility',
    temporal: 'Temporal',
  },

  // ── Pricing ───────────────────────────────────────────────────────────────
  fee_category: {
    rental: 'Rental',
    energy: 'Energy',
    personnel: 'Personnel',
  },

  rate_type: {
    hourly: 'Hourly',
    flat: 'Flat',
    variable: 'Variable',
  },

  time_period: {
    am: 'AM',
    pm: 'PM',
    all_day: 'All Day',
  },

  // ── Employment ────────────────────────────────────────────────────────────
  employment_status: {
    active: 'Active',
    resigned: 'Resigned',
    on_leave: 'On Leave',
  },

  // ── Misc ──────────────────────────────────────────────────────────────────
  file_type: {
    csv: 'CSV',
    xlsx: 'XLSX',
    xls: 'XLS',
  },

  entry_source: {
    file_parsed: 'File Parsed',
    manual_entry: 'Manual Entry',
  },

  amenity_source: {
    manual: 'Manual',
    inventory: 'Inventory',
  },

  applies_to: {
    all: 'All',
    internal: 'Internal',
    external: 'External',
  },

  user_preference_category: {
    notifications: 'Notifications',
    locale: 'Locale',
    appearance: 'Appearance',
  },
}

// ---------------------------------------------------------------------------
// Main lookup: specific override → generic fallback
// ---------------------------------------------------------------------------

/**
 * Convert a DB enum value to a human-readable label.
 *
 * @param enumType  The enum family (e.g. 'booking_status', 'payment_method').
 *                  Use the same keys as ENUM_LABELS above.
 * @param value     The raw DB string value.
 */
export function labelFor(enumType: string, value?: string | null): string {
  if (!value) return '—'
  return ENUM_LABELS[enumType]?.[value] ?? formatEnumLabel(value)
}

// ---------------------------------------------------------------------------
// Convenience helpers for the most common enums
// ---------------------------------------------------------------------------

export const bookingStatusLabel = (v?: string | null) => labelFor('booking_status', v)
export const paymentStatusLabel = (v?: string | null) => labelFor('payment_status', v)
export const paymentMethodLabel = (v?: string | null) => labelFor('payment_method', v)
export const userRoleLabel = (v?: string | null) => labelFor('user_role', v)
export const accountStatusLabel = (v?: string | null) => labelFor('account_status', v)
export const bookingTypeLabel = (v?: string | null) => labelFor('booking_type', v)
export const bookingPurposeLabel = (v?: string | null) => labelFor('booking_purpose', v)
export const equipmentReportStatusLabel = (v?: string | null) => labelFor('equipment_report_status', v)
export const equipmentReportCategoryLabel = (v?: string | null) => labelFor('equipment_report_category', v)
export const equipmentRequestStatusLabel = (v?: string | null) => labelFor('equipment_request_status', v)
export const emergencyRequestStatusLabel = (v?: string | null) => labelFor('emergency_request_status', v)
export const cancellationTypeLabel = (v?: string | null) => labelFor('cancellation_type', v)
export const feeCategoryLabel = (v?: string | null) => labelFor('fee_category', v)
export const uploadStatusLabel = (v?: string | null) => labelFor('upload_status', v)
export const eventApprovalStatusLabel = (v?: string | null) => labelFor('event_approval_status', v)
export const scheduleIssueStatusLabel = (v?: string | null) => labelFor('schedule_issue_status', v)
export const scheduleIssueCategoryLabel = (v?: string | null) => labelFor('schedule_issue_category', v)
export const maintenanceStatusLabel = (v?: string | null) => labelFor('maintenance_status', v)
export const maintenanceTypeLabel = (v?: string | null) => labelFor('maintenance_type', v)
export const facilityStatusLabel = (v?: string | null) => labelFor('facility_status', v)
export const deliveryModeLabel = (v?: string | null) => labelFor('delivery_mode', v)
export const approvalStatusLabel = (v?: string | null) => labelFor('approval_status', v)
export const termTypeLabel = (v?: string | null) => labelFor('term_type', v)
export const managedByLabel = (v?: string | null) => labelFor('managed_by', v)
