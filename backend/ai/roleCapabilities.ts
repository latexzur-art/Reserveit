/**
 * Role capability registry for the AI Assistant.
 *
 * Single source of truth mapping each ReserveIT role → what the assistant may do
 * on their behalf: which data tools it can call, which guarded write-actions it
 * can propose, where it can navigate them, and the role-aware starter chips.
 *
 * The chat brain filters the tools/actions it exposes to the model by the
 * caller's resolved capability; every read executor re-checks `tools` and every
 * write-action re-checks `actions`, and the underlying endpoints re-authorize —
 * a triple gate. The assistant can only ever *propose* a write; nothing mutates
 * without an explicit user Confirm hitting /api/ai/action.
 *
 * @module backend/ai/roleCapabilities
 */

import { ROLE_PRIORITY } from '@/backend/auth/auth.constants'
import { ROUTES } from '@/lib/routes'

// ─── Canonical vocabularies (shared with tools.ts + actions.ts) ────────────────
export type AssistantToolName =
  // Booking tools (existing)
  | 'search_availability'
  | 'get_my_bookings'
  | 'get_booking_policies'
  | 'score_booking'
  | 'suggest_room'
  // Role lookups (proxy to existing endpoints)
  | 'get_pending_reviews'
  | 'get_reliability'
  | 'get_facility_status'
  | 'get_today_bookings'
  | 'get_pending_paid_bookings'
  | 'search_users'
  | 'get_audit_logs'
  | 'get_my_credits'
  | 'get_my_payments'
  | 'get_my_cancellation_requests'
  | 'get_my_reliability'
  | 'get_schedule_reviews'
  | 'get_reports_summary'
  | 'get_maintenance'
  | 'get_roles'
  | 'get_reports'
  // Unified people lookup (role-scoped facets)
  | 'view_person'
  // Client / Faculty self-service reads
  | 'get_notifications'
  | 'get_my_schedule'
  // Program Head — department management reads
  | 'get_courses'
  | 'get_curriculum_pending'
  | 'get_schedule_uploads'
  | 'get_professor_assignments'
  | 'get_approved_schedules'
  | 'get_sections'
  | 'get_upload_history'
  | 'get_school_events'
  // Academic Head — oversight reads
  | 'get_departments'
  | 'get_change_requests'
  | 'get_special_events'
  | 'get_all_bookings'
  | 'get_faculty_availability'
  | 'get_assignment_lineups'
  | 'get_schedule_history'
  | 'get_schedule_exceptions'
  // Building Admin — facility / equipment / oversight reads
  | 'get_rates'
  | 'get_equipment'
  | 'get_hvac'
  | 'get_issue_reports'
  | 'get_restricted_users'
  | 'get_faq'
  | 'get_building_bookings'
  | 'get_class_schedules'
  | 'get_calendar_events'
  | 'get_reports_analytics'
  | 'get_directory'
  | 'get_payment_transactions'
  | 'get_emergency_requests'
  | 'get_facility_reviews'
  | 'get_school_event_blocks'
  // IT Admin — terms / tech equipment / assign requests
  | 'get_academic_terms'
  | 'get_tech_equipment'
  | 'get_tech_reports'
  | 'get_assignment_requests'
  // PAMO Officer (non-tech equipment inventory)
  | 'get_pamo_equipment'
  | 'get_pamo_attention'
  | 'get_pamo_equipment_stats'
  | 'get_pamo_reports'
  // Cross-role facility & schedule reads
  | 'get_facility_warnings'
  | 'get_schedule_reports'
  | 'get_hvac_schedule_reports'
  // Faculty / Program Head / Academic Head — schedule issue reports & facility equipment
  | 'get_my_schedule_reports'
  | 'get_facility_equipment'
  // Building Admin — schedule report details
  | 'get_schedule_report_logs'
  | 'get_schedule_report_attachments'
  // Building Admin — payment refund ledger
  | 'get_refund_ledger'
  // Building Admin — payment QR codes
  | 'get_qr_codes'
  // Academic Head — cancellation requests awaiting review
  | 'get_cancellation_requests'
  // Read-only campus-wide viewer for the five roles with no privileged school-events tool
  | 'get_upcoming_school_events'

export type AssistantActionType =
  // Self-service
  | 'cancel_my_booking'
  | 'accept_alternative'
  | 'submit_appeal'
  | 'request_reliability_reset'
  | 'emergency_cancel_my_booking'
  | 'report_equipment_issue'
  | 'submit_facility_review'
  // Program Head — curriculum batch lifecycle
  | 'submit_curriculum_batch'
  | 'publish_curriculum_batch'
  | 'request_delete_curriculum_batch'
  // Program Head — schedule uploads, school events & change requests
  | 'submit_schedule_upload'
  | 'create_school_event_ph'
  | 'cancel_school_event_ph'
  | 'submit_schedule_change_request'
  // Academic Head
  | 'approve_booking'
  | 'reject_booking'
  | 'cancel_booking'
  | 'decide_reliability_request'
  | 'reset_reliability'
  | 'publish_schedule_upload'
  | 'approve_curriculum_batch'
  | 'reject_curriculum_batch'
  | 'send_back_curriculum_batch'
  | 'decide_change_request'
  | 'batch_approve_reviews'
  | 'approve_schedule_upload'
  | 'reject_schedule_upload'
  | 'create_school_event'
  | 'cancel_school_event'
  | 'create_academic_term'
  | 'delete_booking'
  | 'assign_professor'
  | 'unassign_professor'
  | 'approve_assignment_lineup'
  | 'reject_assignment_lineup'
  | 'edit_schedule'
  | 'create_schedule'
  | 'deactivate_schedule'
  // Building Admin
  | 'approve_paid_booking'
  | 'verify_qr_payment'
  | 'reject_qr_payment'
  | 'confirm_entitlement_refund'
  | 'override_refund'
  | 'set_payment_mode'
  | 'reject_paid_booking'
  | 'cancel_building_booking'
  | 'dismiss_issue_report'
  | 'convert_issue_report'
  | 'lift_building_restriction'
  | 'end_building_probation'
  | 'clear_violations'
  | 'restrict_user'
  | 'place_on_probation'
  | 'create_faq'
  | 'edit_faq'
  | 'delete_faq'
  | 'create_maintenance'
  | 'approve_emergency_reschedule'
  | 'decline_emergency_reschedule'
  | 'approve_assignment_request'
  | 'toggle_facility_rental'
  | 'create_rental_rate'
  | 'update_rental_rate'
  | 'delete_rental_rate'
  // IT Admin
  | 'set_user_status'
  | 'set_active_term'
  | 'assign_role'
  | 'remove_role'
  | 'restore_user'
  | 'lift_restriction'
  | 'end_probation'
  | 'reset_user_password'
  | 'issue_user_credit'
  | 'decide_assignment_request'
  | 'update_tech_report'
  // Schedule issue reporting
  | 'file_schedule_report'
  | 'update_schedule_report'
  | 'escalate_schedule_report'
  | 'update_my_schedule_report'
  | 'notify_faculty'
  // School Events + Exam Period Block: AH-requests/BA-confirms approval workflow
  | 'approve_school_event_request'
  | 'reject_school_event_request'
  | 'confirm_school_event_cancellation'
  | 'decline_school_event_cancellation'
  | 'withdraw_school_event_request'

export interface AssistantDestination {
  id: string
  label: string
  href: string
}

export interface AssistantQuickAction {
  label: string
  prompt: string
}

export interface RoleCapability {
  /** Primary role name (highest-priority role when multiple). */
  role: string
  /** Display label, e.g. "Building Admin". */
  label: string
  /** Prompt snippet describing who the assistant serves. */
  persona: string
  /** Whether this capability includes a booking flow. */
  canBook: boolean
  /** Where "start a booking" lands; null for non-booking roles. */
  defaultFormRoute: string | null
  /** Data/booking tools the model may call. */
  tools: AssistantToolName[]
  /** Guarded write-actions the model may propose. */
  actions: AssistantActionType[]
  /** Pages the assistant can navigate to (also surfaced as quick-jumps). */
  destinations: AssistantDestination[]
  /** Role-aware starter chips shown when the chat opens. */
  quickActions: AssistantQuickAction[]
}

const BOOKING_TOOLS: AssistantToolName[] = [
  'search_availability',
  'get_my_bookings',
  'get_booking_policies',
  'score_booking',
  'suggest_room',
]

// ─── Per-role definitions ──────────────────────────────────────────────────────
const EXTERNAL_CLIENT: RoleCapability = {
  role: 'external_client',
  label: 'Client',
  persona:
    'You are the booking assistant for an EXTERNAL CLIENT. Help them reserve facilities, check availability, review their own bookings, credits and payments. They have no staff/admin powers.',
  canBook: true,
  defaultFormRoute: '/client/booking',
  tools: [...BOOKING_TOOLS, 'get_my_credits', 'get_my_payments', 'get_my_cancellation_requests', 'get_notifications', 'get_facility_warnings', 'get_upcoming_school_events'],
  actions: [
    'cancel_my_booking', 'accept_alternative', 'submit_appeal',
    'emergency_cancel_my_booking', 'report_equipment_issue', 'submit_facility_review',
  ],
  destinations: [
    { id: 'book', label: 'New booking', href: '/client/booking' },
    { id: 'my_bookings', label: 'My bookings', href: '/client/bookings' },
    { id: 'calendar', label: 'Calendar', href: '/client/calendar' },
    { id: 'credits', label: 'My credits', href: '/client/credits' },
    { id: 'payments', label: 'Payments', href: '/client/payment' },
    { id: 'notifications', label: 'Notifications', href: '/client/notifications' },
  ],
  quickActions: [
    { label: 'Reserve a facility', prompt: 'I want to reserve a facility' },
    { label: 'My bookings', prompt: 'What do I have booked?' },
    { label: 'My credits', prompt: 'How many credits do I have left?' },
  ],
}

const FACULTY: RoleCapability = {
  role: 'faculty',
  label: 'Faculty',
  persona:
    'You are the assistant for a FACULTY member. Help them book rooms for classes/activities, check availability, see their own reservations and teaching schedule, and answer booking-policy questions.',
  canBook: true,
  defaultFormRoute: '/faculty/form',
  tools: [...BOOKING_TOOLS, 'get_my_reliability', 'get_my_payments', 'get_my_cancellation_requests', 'get_notifications', 'get_my_schedule', 'get_facility_warnings', 'get_my_schedule_reports', 'get_facility_equipment', 'get_upcoming_school_events'],
  actions: [
    'cancel_my_booking', 'accept_alternative', 'submit_appeal', 'request_reliability_reset',
    'emergency_cancel_my_booking', 'report_equipment_issue', 'submit_facility_review',
    'file_schedule_report', 'update_my_schedule_report',
  ],
  destinations: [
    { id: 'book', label: 'New reservation', href: '/faculty/form' },
    { id: 'my_bookings', label: 'My reservations', href: '/faculty/reservations' },
    { id: 'my_schedule', label: 'My schedules', href: '/faculty/schedules' },
    { id: 'calendar', label: 'Calendar', href: '/faculty/calendar' },
    { id: 'payments', label: 'Payments', href: '/faculty/payment' },
    { id: 'notifications', label: 'Notifications', href: '/faculty/notifications' },
  ],
  quickActions: [
    { label: 'Book a room for class', prompt: 'Book a room for my class' },
    { label: "What's free Friday 2pm?", prompt: 'What rooms are free this Friday at 2pm?' },
    { label: 'My reservations', prompt: 'What do I have booked?' },
  ],
}

const PROGRAM_HEAD: RoleCapability = {
  role: 'program_head',
  label: 'Program Head',
  persona:
    'You are the assistant for a PROGRAM HEAD \u2014 the academic manager of a department. In addition to booking rooms, help them manage their department\u2019s courses, curriculum, class-schedule uploads, professor assignments to sections, and school event requests. They submit work to the Academic Head for approval (curriculum batches, schedule uploads, assignment lineups, school events). Use navigate to take them to the right management page.',
  canBook: true,
  defaultFormRoute: '/program/form',
  tools: [
    // NOTE: get_curriculum_pending is Academic-Head-only (its endpoint 403s a
    // program head); PH sees pending curriculum via get_courses(approval_status).
    ...BOOKING_TOOLS, 'view_person',
    'get_courses', 'get_schedule_uploads',
    'get_professor_assignments', 'get_approved_schedules', 'get_sections',
    'get_upload_history', 'get_school_events', 'get_upcoming_school_events',
    'get_faculty_availability', 'get_notifications', 'get_change_requests',
    'get_facility_warnings', 'get_my_schedule_reports', 'get_facility_equipment', 'get_my_payments',
    'get_my_cancellation_requests',
  ],
  actions: [
    // Self-service (same as Faculty)
    'cancel_my_booking', 'accept_alternative', 'submit_appeal',
    'request_reliability_reset', 'emergency_cancel_my_booking',
    'report_equipment_issue', 'submit_facility_review', 'file_schedule_report', 'update_my_schedule_report',
    // Curriculum batch lifecycle
    'submit_curriculum_batch', 'publish_curriculum_batch', 'request_delete_curriculum_batch',
    // Professor assignments
    'assign_professor', 'unassign_professor',
    // Schedule uploads & change requests
    'submit_schedule_upload', 'submit_schedule_change_request',
    // School events
    'create_school_event_ph', 'cancel_school_event_ph',
  ],
  destinations: [
    { id: 'book', label: 'New reservation', href: '/program/form' },
    { id: 'my_bookings', label: 'My reservations', href: '/program/reservations' },
    { id: 'courses', label: 'Courses', href: '/program/courses' },
    { id: 'curriculum', label: 'Curriculum', href: '/program/curriculum' },
    { id: 'schedule_mgmt', label: 'Schedule management', href: '/program/schedule-management' },
    { id: 'schedule_uploads', label: 'Schedule uploads', href: '/program/schedules/uploads' },
    { id: 'approved_schedules', label: 'Approved schedules', href: '/program/approved-schedules' },
    { id: 'school_events', label: 'School events', href: '/program/school-events' },
    { id: 'calendar', label: 'Calendar', href: '/program/calendar' },
    { id: 'assignments', label: 'Assignments', href: ROUTES.program.schedulesAssignments },
    { id: 'sections', label: 'Sections', href: ROUTES.program.programSections },
    { id: 'upload_history', label: 'Upload history', href: '/program/history' },
    { id: 'faculty', label: 'Faculty directory', href: '/program/faculty' },
    { id: 'facilities', label: 'Facilities', href: '/program/facilities' },
    { id: 'profile', label: 'Profile', href: '/program/profile' },
    { id: 'payment', label: 'Payment', href: '/program/payment' },
    { id: 'notifications', label: 'Notifications', href: '/program/notifications' },
  ],
  quickActions: [
    { label: 'Book a room', prompt: 'Book a room for a department activity' },
    { label: 'Schedule uploads', prompt: 'Show me my schedule uploads' },
    { label: 'Manage courses', prompt: 'Take me to course management' },
    { label: 'My department faculty', prompt: 'Show the faculty in my department' },
    { label: 'Pending assignments', prompt: 'Show professor assignments that need my attention' },
    { label: 'School events', prompt: 'Show my school event requests' },
    { label: 'Approved schedules', prompt: 'Show the live class schedule' },
    { label: 'Notifications', prompt: 'Show my notifications' },
  ],
}

const ACADEMIC_HEAD: RoleCapability = {
  role: 'academic_head',
  label: 'Academic Head',
  persona:
    'You are the assistant for the ACADEMIC HEAD — the academic decision-maker. They review bookings, oversee curriculum and departments, manage class schedules, and handle faculty reliability. Be thorough when presenting review items (they need the full picture to decide) and always require confirmation before proposing any action.',
  canBook: true,
  defaultFormRoute: ROUTES.academic.reserve,
  tools: [
    ...BOOKING_TOOLS, 'get_pending_reviews', 'get_reliability', 'get_schedule_reviews', 'view_person',
    'get_professor_assignments', 'get_approved_schedules', 'get_sections', 'get_curriculum_pending',
    'get_departments', 'get_change_requests', 'get_special_events',
    'get_all_bookings', 'get_faculty_availability', 'get_assignment_lineups',
    'get_schedule_history', 'get_schedule_exceptions',
    'get_facility_warnings', 'get_schedule_reports', 'get_my_schedule_reports', 'get_facility_equipment', 'get_my_payments',
    'get_my_cancellation_requests', 'get_cancellation_requests', 'get_school_event_blocks',
  ],
  actions: [
    'approve_booking', 'reject_booking', 'cancel_my_booking', 'cancel_booking',
    'decide_reliability_request', 'reset_reliability', 'publish_schedule_upload',
    'approve_curriculum_batch', 'reject_curriculum_batch', 'send_back_curriculum_batch',
    'decide_change_request', 'batch_approve_reviews',
    'approve_schedule_upload', 'reject_schedule_upload',
    'create_school_event', 'cancel_school_event', 'withdraw_school_event_request',
    'create_academic_term', 'delete_booking',
    'assign_professor', 'unassign_professor',
    'approve_assignment_lineup', 'reject_assignment_lineup',
    'edit_schedule', 'create_schedule', 'deactivate_schedule',
    'file_schedule_report', 'update_my_schedule_report', 'report_equipment_issue',
  ],
  destinations: [
    { id: 'reserve', label: 'Reserve', href: ROUTES.academic.reserve },
    { id: 'my_bookings', label: 'My reservations', href: ROUTES.academic.myReservations },
    { id: 'cancellation_requests', label: 'Cancellation Requests', href: ROUTES.academic.dashboard },
    { id: 'approval_queue', label: 'Curriculum approval queue', href: ROUTES.academic.curriculumApprovalQueue },
    { id: 'departments', label: 'Departments', href: ROUTES.academic.departments },
    { id: 'reliability', label: 'Reliability', href: ROUTES.academic.departmentsReliability },
    { id: 'schedules', label: 'All schedules', href: ROUTES.academic.schedulesAll },
    { id: 'change_requests', label: 'Change requests', href: ROUTES.academic.schedulesChangeRequests },
    { id: 'special_events', label: 'Special-events queue', href: ROUTES.academic.specialEventsQueue },
    { id: 'schedule_reviews', label: 'Schedule reviews', href: ROUTES.academic.schedulesReview },
    { id: 'assignments', label: 'Assignments', href: ROUTES.academic.schedulesAssignments },
    { id: 'sections', label: 'Sections', href: ROUTES.academic.academicSections },
    { id: 'schedule_uploads', label: 'Schedule uploads', href: ROUTES.academic.schedulesUploads },
    { id: 'schedule_calendar', label: 'Schedule calendar', href: ROUTES.academic.schedulesCalendar },
    { id: 'schedule_history', label: 'Schedule history', href: ROUTES.academic.schedulesHistory },
    { id: 'academic_terms', label: 'Academic terms', href: ROUTES.academic.schedulesTerms },
    { id: 'course_catalog', label: 'Course catalog', href: ROUTES.academic.curriculumCourseCatalog },
    { id: 'notifications', label: 'Notifications', href: ROUTES.academic.notifications },
    { id: 'school_events', label: 'School events', href: ROUTES.academic.schedulesEvents },
  ],
  quickActions: [
    { label: 'Bookings to review', prompt: 'Show bookings waiting for my review' },
    { label: 'Check reliability', prompt: "Check a faculty member's reliability standing" },
    { label: 'Special events', prompt: 'Take me to the special-events queue' },
    { label: 'Pending schedule reviews', prompt: 'Show schedule uploads waiting for my review' },
    { label: "Today's class schedule", prompt: 'What classes are scheduled today?' },
    { label: 'Unassigned classes', prompt: 'Show classes with no instructor assigned' },
    { label: 'Pending curriculum', prompt: 'Show curriculum batches waiting for approval' },
    { label: 'Reliability concerns', prompt: 'Which faculty have reliability concerns?' },
    { label: 'Upcoming events', prompt: 'Show upcoming school events' },
    { label: 'Pending lineups', prompt: 'Show professor assignment lineups awaiting review' },
  ],
}

const BUILDING_ADMIN: RoleCapability = {
  role: 'building_admin',
  label: 'Building Admin',
  persona:
    'You are the assistant for the BUILDING ADMIN — the operational front-line for the campus. They juggle facilities, equipment (including HVAC), room availability, reservations, pricing, restricted users, maintenance, and reports. Be efficient and direct — they are busy. When they ask about something, look it up with your tools and either answer or take them to the right page. Propose write-actions only when clearly needed, and always require confirmation.',
  canBook: true,
  defaultFormRoute: ROUTES.buildingAdmin.reserve,
  tools: [
    ...BOOKING_TOOLS, 'get_facility_status', 'get_today_bookings', 'get_pending_paid_bookings',
    'get_reports_summary', 'get_maintenance', 'view_person',
    'get_rates', 'get_equipment', 'get_hvac', 'get_issue_reports',
    'get_restricted_users', 'get_faq', 'get_building_bookings', 'get_class_schedules',
    'get_calendar_events', 'get_reports_analytics', 'get_directory',
    'get_payment_transactions', 'get_emergency_requests', 'get_facility_reviews',
    'get_school_event_blocks', 'get_facility_warnings', 'get_schedule_reports',
    'get_hvac_schedule_reports', 'get_schedule_report_logs', 'get_schedule_report_attachments',
    'get_my_schedule_reports', 'get_refund_ledger', 'get_qr_codes',
  ],
  actions: [
    'approve_paid_booking', 'reject_paid_booking', 'cancel_building_booking', 'cancel_my_booking',
    'dismiss_issue_report', 'convert_issue_report',
    'lift_building_restriction', 'end_building_probation', 'clear_violations',
    'restrict_user', 'place_on_probation',
    'create_school_event', 'cancel_school_event', 'withdraw_school_event_request',
    'approve_school_event_request', 'reject_school_event_request',
    'confirm_school_event_cancellation', 'decline_school_event_cancellation',
    'create_faq', 'edit_faq', 'delete_faq',
    'create_maintenance', 'approve_emergency_reschedule', 'decline_emergency_reschedule',
    'approve_assignment_request',
    'edit_schedule',
    'toggle_facility_rental', 'create_rental_rate', 'update_rental_rate', 'delete_rental_rate',
    'update_schedule_report', 'escalate_schedule_report', 'notify_faculty',
    'file_schedule_report', 'update_my_schedule_report',
    // Payment review + refunds
    'verify_qr_payment', 'reject_qr_payment', 'confirm_entitlement_refund', 'override_refund',
    'set_payment_mode',
  ],
  destinations: [
    { id: 'reserve', label: 'Manual booking', href: ROUTES.buildingAdmin.reserve },
    { id: 'facilities', label: 'Facility management', href: ROUTES.buildingAdmin.facilityManagement },
    { id: 'pricing', label: 'Pricing', href: ROUTES.buildingAdmin.pricing },
    { id: 'reservations', label: 'Reservations', href: ROUTES.buildingAdmin.reservations },
    { id: 'room_availability', label: 'Room availability', href: ROUTES.buildingAdmin.roomAvailability },
    { id: 'restricted_users', label: 'Restricted users', href: ROUTES.buildingAdmin.restrictedUsers },
    { id: 'reports', label: 'Reports', href: ROUTES.buildingAdmin.reports },
    { id: 'maintenance', label: 'Maintenance logs', href: ROUTES.buildingAdmin.maintenanceLogs },
    { id: 'payments', label: 'Payment logs', href: ROUTES.buildingAdmin.paymentLogs },
    { id: 'payment_management', label: 'Payment Management', href: ROUTES.buildingAdmin.paymentManagement },
    { id: 'calendar', label: 'Calendar', href: ROUTES.buildingAdmin.calendar },
    { id: 'directory', label: 'Personnel directory', href: ROUTES.buildingAdmin.directory },
    { id: 'equipment', label: 'Equipment', href: ROUTES.buildingAdmin.equipment },
    { id: 'equipment_hvac', label: 'HVAC Fixtures', href: ROUTES.buildingAdmin.equipmentHvac },
    { id: 'equipment_reports', label: 'Equipment reports', href: ROUTES.buildingAdmin.equipmentReports },
    { id: 'equipment_requests', label: 'Assign requests', href: ROUTES.buildingAdmin.equipmentRequests },
    { id: 'faq', label: 'FAQ management', href: ROUTES.buildingAdmin.faq },
    { id: 'notifications', label: 'Notifications', href: ROUTES.buildingAdmin.notifications },
    { id: 'messages', label: 'Messages', href: ROUTES.buildingAdmin.messages },
    { id: 'school_events', label: 'School events', href: ROUTES.buildingAdmin.schoolEvents },
  ],
  quickActions: [
    { label: 'Facility status today', prompt: 'What is the facility status today?' },
    { label: "Today's bookings", prompt: 'Show me today’s bookings' },
    { label: 'Fixed classes today', prompt: 'Show the fixed class schedule for today' },
    { label: 'Pending paid bookings', prompt: 'Show paid bookings waiting for approval' },
    { label: 'Professors with classes', prompt: 'List all professors who have classes today' },
    { label: 'Room availability now', prompt: 'Which rooms are available right now?' },
    { label: "This week’s events", prompt: 'What events are scheduled this week?' },
    { label: 'Unassigned classes', prompt: 'Show classes that have no instructor assigned' },
    { label: 'HVAC status', prompt: 'Show me the HVAC fixtures status' },
    { label: 'Create a school event', prompt: 'Create a school event that blocks a facility' },
    { label: 'Block an exam period', prompt: 'Block all facilities for the upcoming exam period' },
    { label: 'Set up rental facility', prompt: 'I want to set up a facility for rental' },
  ],
}

const USER_MANAGER: RoleCapability = {
  role: 'it_admin',
  label: 'IT Admin',
  persona:
    'You are the assistant for the IT ADMIN — they manage user accounts, roles, audit logs, tech equipment, and academic terms. Be precise with user lookups (they handle sensitive account changes). Always require confirmation before proposing status changes. You do NOT handle room bookings.',
  canBook: false,
  defaultFormRoute: null,
  tools: [
    'search_users', 'get_audit_logs', 'get_roles', 'get_reports', 'view_person',
    'get_academic_terms', 'get_tech_equipment', 'get_tech_reports', 'get_assignment_requests', 'get_departments',
    'get_facility_warnings', 'get_schedule_reports', 'get_upcoming_school_events',
  ],
  actions: [
    'set_user_status', 'set_active_term', 'assign_role', 'remove_role', 'restore_user',
    'lift_restriction', 'end_probation',
    'reset_user_password', 'issue_user_credit', 'decide_assignment_request', 'update_tech_report',
  ],
  destinations: [
    { id: 'users', label: 'Users', href: ROUTES.userManager.root },
    { id: 'equipment', label: 'Tech Equipment', href: ROUTES.userManager.equipment },
    { id: 'equipment_reports', label: 'Tech Reports', href: ROUTES.userManager.equipmentReports },
    { id: 'equipment_requests', label: 'Assign Requests', href: ROUTES.userManager.equipmentRequests },
    { id: 'reports', label: 'Reports', href: '/admin/reports' },
    { id: 'settings', label: 'Settings', href: '/admin/settings' },
    { id: 'terms', label: 'Academic terms', href: '/admin/schedules/terms' },
  ],
  quickActions: [
    { label: 'Find a user', prompt: 'Find a user by name or email' },
    { label: 'Pending activations', prompt: 'Show users pending activation' },
    { label: 'Recent audit logs', prompt: 'Show the most recent audit logs' },
  ],
}

const PAMO_OFFICER: RoleCapability = {
  role: 'pamo_officer',
  label: 'PAMO Officer',
  persona:
    'You are the assistant for the PAMO OFFICER (Purchasing & Asset Management). They manage the NON-TECH equipment inventory — look up items by category or facility, see what needs attention, and check inventory stats and reports. Use navigate to take them to the right page. You do NOT handle room bookings.',
  canBook: false,
  defaultFormRoute: null,
  tools: ['get_pamo_equipment', 'get_pamo_attention', 'get_pamo_equipment_stats', 'get_pamo_reports', 'get_facility_warnings', 'get_schedule_reports', 'get_upcoming_school_events'],
  actions: [],
  destinations: [
    { id: 'overview', label: 'Overview', href: ROUTES.pamo.home },
    { id: 'equipment', label: 'Equipment', href: ROUTES.pamo.equipment },
    { id: 'reports', label: 'Reports', href: ROUTES.pamo.reports },
    { id: 'notifications', label: 'Notifications', href: ROUTES.pamo.notifications },
  ],
  quickActions: [
    { label: 'Needs attention', prompt: 'Show equipment that needs attention' },
    { label: 'Inventory stats', prompt: 'Show the equipment inventory stats' },
    { label: 'Find equipment', prompt: 'Find equipment by name or category' },
  ],
}

export const ROLE_CAPABILITIES: Record<string, RoleCapability> = {
  external_client: EXTERNAL_CLIENT,
  faculty: FACULTY,
  program_head: PROGRAM_HEAD,
  academic_head: ACADEMIC_HEAD,
  building_admin: BUILDING_ADMIN,
  it_admin: USER_MANAGER,
  pamo_officer: PAMO_OFFICER,
}

// ─── Dynamic gates (layer on top of the static capability) ─────────────────────

/** Account statuses whose owner may NOT create bookings or write-actions. */
const BLOCKED_ACTOR_STATUSES = new Set(['restricted', 'suspended', 'inactive'])

/**
 * True when the acting user's account is restricted/suspended/inactive — the
 * assistant must refuse bookings and write-actions and explain why in chat.
 * Probation is NOT blocked (probationary users may still book). Case-insensitive;
 * a missing status is treated as not blocked.
 */
export function isActorBlocked(status: string | null | undefined): boolean {
  return typeof status === 'string' && BLOCKED_ACTOR_STATUSES.has(status.trim().toLowerCase())
}

function parseKillList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

/**
 * Per-role / per-action kill-switch. Reads `AI_KILL_ROLES` and `AI_KILL_ACTIONS`
 * (comma-separated) to disable the assistant's agentic surface WITHOUT touching
 * the underlying booking/admin features. A killed role loses all tools+actions;
 * a killed action is stripped from every role. Env is injectable for tests.
 */
export function applyKillSwitches(
  caps: RoleCapability,
  env: Record<string, string | undefined> = process.env
): RoleCapability {
  const killedRoles = parseKillList(env.AI_KILL_ROLES)
  const killedActions = parseKillList(env.AI_KILL_ACTIONS)

  if (killedRoles.has(caps.role)) {
    return { ...caps, tools: [], actions: [] }
  }
  if (killedActions.size === 0) return caps
  return { ...caps, actions: caps.actions.filter((a) => !killedActions.has(a)) }
}

function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(item)
    }
  }
  return out
}

/**
 * Resolve a user's effective capability by UNIONing every role they hold, while
 * keeping the highest-priority role's identity (label/persona/defaultFormRoute).
 * Falls back to the external-client (booking-only) surface for unknown/empty roles.
 */
export function resolveCapabilities(
  roles: Array<{ name: string }> | string[] | null | undefined
): RoleCapability {
  const roleNames = (roles ?? [])
    .map((r) => (typeof r === 'string' ? r : r?.name))
    .filter((n): n is string => typeof n === 'string' && n in ROLE_CAPABILITIES)

  if (roleNames.length === 0) {
    return EXTERNAL_CLIENT
  }

  // Primary identity = highest-priority role present.
  const primaryRole =
    ROLE_PRIORITY.find((r) => roleNames.includes(r)) ?? roleNames[0]
  const primary = ROLE_CAPABILITIES[primaryRole]

  // Order the union by role priority for stable, sensible grouping.
  const ordered = ROLE_PRIORITY.filter((r) => roleNames.includes(r))
  const caps = ordered.map((r) => ROLE_CAPABILITIES[r])

  const tools = uniqueBy(caps.flatMap((c) => c.tools), (t) => t) as AssistantToolName[]
  const actions = uniqueBy(caps.flatMap((c) => c.actions), (a) => a) as AssistantActionType[]
  const destinations = uniqueBy(caps.flatMap((c) => c.destinations), (d) => d.href)
  // Cap raised 10 -> 11: Building Admin's list grew to 12 real entries with this feature's
  // exam-period quick action, and was already silently dropping its 11th at the old cap.
  const quickActions = uniqueBy(caps.flatMap((c) => c.quickActions), (q) => q.label).slice(0, 11)
  const canBook = caps.some((c) => c.canBook)
  const defaultFormRoute =
    caps.find((c) => c.defaultFormRoute)?.defaultFormRoute ?? null

  return {
    role: primary.role,
    label: primary.label,
    persona: primary.persona,
    canBook,
    defaultFormRoute,
    tools,
    actions,
    destinations,
    quickActions,
  }
}
