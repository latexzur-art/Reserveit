/**
 * AI Assistant tool schemas + role-aware definition builder.
 * @module backend/ai/tools/definitions
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssistantToolName, RoleCapability } from '@/backend/ai/roleCapabilities'
import type { PreviewFields, PreviewUserProfile } from '@/backend/booking/scorePreview'

// OpenAI/OpenRouter tool definition shape (subset we use).
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolContext {
  supabase: SupabaseClient
  /** RLS-scoped (user JWT) client for user-owned reads; falls back to `supabase`. */
  supabaseUser?: SupabaseClient
  userProfile: PreviewUserProfile
  /** Server-side accumulated booking fields; tool args are merged over these. */
  currentFields: PreviewFields
  /** Resolved role capability — gates which lookups are permitted. */
  caps: RoleCapability
  /** Forwarded cookie so role-lookup proxies authenticate as the same user. */
  cookie: string | null
  /** Absolute origin for internal proxy fetches. */
  origin: string
}

export const TERMINAL_TOOL = 'emit_result'

// ─── Recent bookings (shared by get_my_bookings + prompt memory) ───────────────
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_availability',
      description: "Find rooms that are free for a given date (and optional time window). Use to answer 'is X free?' and to see options before suggesting a room.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start: { type: 'string', description: 'HH:MM 24h (optional)' },
          end: { type: 'string', description: 'HH:MM 24h (optional)' },
          facility_hint: { type: 'string', description: 'optional room name/keyword to filter by' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_bookings',
      description: "Look up the current user's own reservations (upcoming, past, or all). Use to answer questions about what they have booked and to offer rebooking.",
      parameters: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['upcoming', 'past', 'all'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_policies',
      description: 'Get the booking rules/policies (operating hours, how approval scoring works, paid facilities, Sundays, advance limits, facility mismatch).',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['hours', 'scoring', 'paid', 'sundays', 'advance', 'mismatch'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_booking',
      description: 'Compute the REAL auto-approval grade for the booking being assembled (hard constraints + 0–100 score). Always call this before confirming a standard booking. Pass any fields you have; known fields are merged in.',
      parameters: {
        type: 'object',
        properties: {
          facility_id: { type: 'string' },
          booking_date: { type: 'string' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          booking_purpose: { type: 'string' },
          expected_attendees: { type: 'number' },
          session_type: { type: 'string', enum: ['lecture', 'lab'] },
          booking_course_code: { type: 'string' },
          booking_department_code: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_room',
      description: 'Pick the best-fit available room for the booking and rate how well each fits (capacity, type, specialization). Excludes paid/rental facilities unless prefer_paid is true.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          booking_purpose: { type: 'string' },
          expected_attendees: { type: 'number' },
          session_type: { type: 'string', enum: ['lecture', 'lab'] },
          booking_course_code: { type: 'string' },
          prefer_paid: { type: 'boolean', description: 'true only if the user explicitly wants a paid/rental facility like the gym' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TERMINAL_TOOL,
      description: 'Return your final response to the user. Call this exactly once at the end of every turn. intent="question" for a plain answer; "lookup" after reporting data you fetched; "booking"/"reserve_now" for the booking flow; "action" when proposing a write-action. To take the user somewhere set action.kind="navigate". To PROPOSE a change (approve/cancel/etc.) set action.kind="mutate" — this NEVER runs automatically; the user must confirm.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'conversational reply to show the user' },
          intent: { type: 'string', enum: ['booking', 'question', 'reserve_now', 'lookup', 'action'] },
          booking_flow: { type: 'string', enum: ['standard', 'paid'] },
          ready_to_confirm: { type: 'boolean' },
          action: {
            type: 'object',
            description: 'Optional. kind="navigate" → open a page (use a destination_id from the provided list, or an href, plus a label; optional prefill for booking forms). kind="mutate" → propose a guarded write-action the user must confirm (set action_type, params, and a clear summary).',
            properties: {
              kind: { type: 'string', enum: ['navigate', 'mutate'] },
              destination_id: { type: 'string' },
              href: { type: 'string' },
              label: { type: 'string' },
              prefill: { type: 'object' },
              action_type: { type: 'string' },
              params: { type: 'object' },
              summary: { type: 'string' },
            },
          },
          collected_fields: {
            type: 'object',
            properties: {
              facility_id: { type: ['string', 'null'] },
              facility_name: { type: ['string', 'null'] },
              booking_date: { type: ['string', 'null'] },
              start_time: { type: ['string', 'null'] },
              end_time: { type: ['string', 'null'] },
              booking_purpose: { type: ['string', 'null'] },
              expected_attendees: { type: ['number', 'null'] },
              booking_department_code: { type: ['string', 'null'] },
              booking_course_code: { type: ['string', 'null'] },
              session_type: { type: ['string', 'null'] },
              event_name: { type: ['string', 'null'] },
              facility_purpose_category: { type: ['string', 'null'] },
              purpose: { type: ['string', 'null'] },
              special_requests: { type: ['string', 'null'] },
            },
          },
        },
        required: ['message', 'intent'],
      },
    },
  },
]

// ─── Role lookup tools (proxy to existing endpoints) ───────────────────────────
// Each maps to a GET endpoint that already enforces the role. The executor
// forwards the user's cookie so the endpoint authenticates as them.
export const LOOKUP_ENDPOINTS: Partial<
  Record<AssistantToolName, { path: string; params?: string[]; defaults?: Record<string, string> }>
> = {
  get_pending_reviews: { path: '/api/academic-head/mismatch-reviews' },
  get_reliability: { path: '/api/academic-head/reliability', params: ['search'] },
  get_facility_status: { path: '/api/admin/building/dashboard/facility-status' },
  get_today_bookings: { path: '/api/admin/building/dashboard/today' },
  get_pending_paid_bookings: {
    path: '/api/admin/building/bookings',
    params: ['search'],
    defaults: { status: 'pending', type: 'paid', pageSize: '15' },
  },
  search_users: { path: '/api/admin/users', params: ['search', 'status', 'role', 'type'], defaults: { pageSize: '15' } },
  get_audit_logs: { path: '/api/admin/audit-logs', defaults: { pageSize: '15' } },
  get_my_credits: { path: '/api/credits/balance' },
  get_my_payments: { path: '/api/payments' },
  get_my_cancellation_requests: { path: '/api/bookings/my-cancellation-requests' },
  get_my_reliability: { path: '/api/users/reliability-score' },
  get_notifications: { path: '/api/notifications' },
  get_my_schedule: { path: '/api/schedules/my-classes' },
  get_schedule_reviews: { path: '/api/schedules/review/pending' },
  get_reports_summary: { path: '/api/admin/building/dashboard/stats' },
  get_maintenance: { path: '/api/admin/building/dashboard/maintenance' },
  get_roles: { path: '/api/admin/roles' },
  get_reports: { path: '/api/admin/reports/metrics' },
  // Program Head — department management reads
  get_courses: { path: '/api/courses', params: ['search', 'department_code', 'term', 'approval_status'], defaults: { limit: '20' } },
  get_curriculum_pending: { path: '/api/courses/approval/pending', params: ['department_code'] },
  get_schedule_uploads: { path: '/api/schedules/uploads', params: ['status'] },
  get_professor_assignments: { path: '/api/schedules/assignments', params: ['status', 'department_id'] },
  get_approved_schedules: { path: '/api/schedules/live', params: ['department_id', 'day_of_week', 'unassigned'], defaults: { limit: '25' } },
  get_sections: { path: '/api/schedules/sections', params: ['courseCode'] },
  get_upload_history: { path: '/api/courses/upload/history', defaults: { limit: '15' } },
  get_school_events: { path: '/api/program-head/schedule-events' },
  // Academic Head — oversight reads
  // Use /api/departments (any authenticated user) not /api/admin/departments
  // (it_admin-only) so academic_head can read it too; both roles are served.
  get_departments: { path: '/api/departments' },
  get_change_requests: { path: '/api/schedules/change-requests', params: ['status'] },
  get_special_events: { path: '/api/admin/special-events', params: ['status'] },
  // Academic Head — extended reads
  get_all_bookings: { path: '/api/academic-head/reservations', params: ['search', 'status', 'department', 'date_from', 'date_to', 'sort'], defaults: { pageSize: '20' } },
  get_faculty_availability: { path: '/api/faculty/availability', params: ['department_id'] },
  get_assignment_lineups: { path: '/api/schedules/assignments', params: ['status', 'department_id'] },
  get_schedule_history: { path: '/api/schedules/all', params: ['department_id', 'day_of_week', 'search'], defaults: { limit: '50' } },
  get_schedule_exceptions: { path: '/api/academic-head/schedule-exceptions', params: ['start_date', 'end_date'] },
  // Building Admin — facility / equipment / oversight reads
  get_rates: { path: '/api/admin/building/rates' },
  get_equipment: { path: '/api/admin/building/equipment', params: ['search', 'status'], defaults: { pageSize: '20' } },
  get_hvac: { path: '/api/admin/building/hvac', params: ['status'] },
  get_issue_reports: { path: '/api/admin/building/issue-reports', params: ['status'] },
  get_restricted_users: { path: '/api/admin/building/restricted-users' },
  get_faq: { path: '/api/faq/admin' },
  get_building_bookings: { path: '/api/admin/building/bookings', params: ['search', 'status', 'type'], defaults: { pageSize: '15' } },
  get_class_schedules: { path: '/api/schedules/live', params: ['facility_id', 'day_of_week', 'department_id', 'academic_term_id', 'unassigned'], defaults: { limit: '200' } },
  // Building Admin — extended reads (Phase 2-3)
  get_calendar_events: { path: '/api/admin/building/calendar', params: ['facility_id', 'start_date', 'end_date'] },
  get_reports_analytics: { path: '/api/admin/building/reports/analytics', params: ['metric', 'period'] },
  get_directory: { path: '/api/admin/building/directory', params: ['search', 'role', 'category'], defaults: { pageSize: '20' } },
  get_payment_transactions: { path: '/api/admin/building/logs/payments', params: ['status', 'search'], defaults: { pageSize: '15' } },
  get_emergency_requests: { path: '/api/admin/building/emergency-reschedule-requests', params: ['status'] },
  get_facility_reviews: { path: '/api/admin/building/reviews', params: ['facility_id', 'status'] },
  // Lists school_event_block bookings grouped by submission (group_id, dates[],
  // facilities[], block_category, created_by_name) — the safe source for
  // cancel_school_event (auto-approved events are absent from get_special_events, and
  // get_calendar_events mixes in non-cancellable facility_blocks IDs). Endpoint guards
  // with requireAcademicHeadOrBuildingAdmin, so both AH and BA are authorized to read it.
  get_school_event_blocks: {
    path: '/api/academic-head/schedule-events',
    params: ['status', 'block_category', 'facility_id', 'start_date', 'end_date'],
  },
  // Read-only, campus-wide viewer for the five roles with no privileged school-events
  // tool. Deliberately distinct from Program Head's get_school_events (own submissions
  // only) -- this one is everyone's blocks, read-only, no ids exposed for cancel.
  get_upcoming_school_events: {
    path: '/api/schedule-events/upcoming',
    params: ['status', 'block_category', 'facility_id', 'start_date', 'end_date'],
  },
  // IT Admin — terms / tech equipment / assign requests
  get_academic_terms: { path: '/api/admin/academic-terms' },
  get_tech_equipment: { path: '/api/admin/users/equipment', params: ['search', 'status'], defaults: { pageSize: '20' } },
  get_tech_reports: { path: '/api/equipment-reports', params: ['status'] },
  get_assignment_requests: { path: '/api/equipment-assignment-requests', params: ['status'] },
  get_pamo_equipment: { path: '/api/admin/pamo/equipment', params: ['search', 'category', 'status'], defaults: { pageSize: '20' } },
  get_pamo_attention: { path: '/api/admin/pamo/equipment/attention' },
  get_pamo_equipment_stats: { path: '/api/admin/pamo/equipment/stats' },
  get_pamo_reports: { path: '/api/admin/pamo/reports/summary' },
  // Cross-role facility & schedule reads
  get_facility_warnings: { path: '/api/facilities/warnings', params: ['facility_id'] },
  get_schedule_reports: { path: '/api/admin/schedule-reports', params: ['status'] },
  get_hvac_schedule_reports: { path: '/api/admin/schedule-reports', params: ['status'], defaults: { category: 'equipment_issue', is_hvac: 'true' } },
  // Faculty / Program Head / Academic Head — own schedule reports & facility equipment
  get_my_schedule_reports: { path: '/api/schedule-reports' },
  get_facility_equipment: { path: '/api/facilities/{facility_id}/equipment', params: ['facility_id'] },
  // Building Admin — schedule report details
  get_schedule_report_logs: { path: '/api/admin/schedule-reports/{report_id}/logs', params: ['report_id'] },
  get_schedule_report_attachments: { path: '/api/schedule-reports/{report_id}/attachments', params: ['report_id'] },
  // Building Admin — payment refund ledger
  get_refund_ledger: { path: '/api/admin/building/payment-refunds', params: ['trigger_type', 'date_from', 'date_to'], defaults: { pageSize: '20' } },
  // Building Admin — payment QR codes
  get_qr_codes: { path: '/api/admin/building/payment-qr-codes' },
  // Academic Head — cancellation requests awaiting review
  get_cancellation_requests: { path: '/api/academic-head/cancellation-requests', params: ['status'] },
}

export const LOOKUP_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_pending_reviews',
      description: 'Academic Head: list bookings flagged for review (facility/department mismatch + scoring) that are waiting for an approve/reject decision.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reliability',
      description: "Academic Head: look up faculty reliability standing (demerits/strikes). Optionally filter by a name or email via 'search'.",
      parameters: { type: 'object', properties: { search: { type: 'string', description: 'name or email to filter by' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_facility_status',
      description: 'Building Admin: live status of all facilities right now (available / in-use / maintenance).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_today_bookings',
      description: "Building Admin: today's bookings across all facilities.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_paid_bookings',
      description: 'Building Admin: paid/rental bookings awaiting approval. Each has a booking_id you can use to propose approve_paid_booking.',
      parameters: { type: 'object', properties: { search: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_users',
      description: "IT Admin: search user accounts. Filter by 'search' (name/email), 'status' (pending|active|suspended|inactive|restricted), 'role', or 'type' (internal|external). Each result has a user_id for set_user_status.",
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          status: { type: 'string' },
          role: { type: 'string' },
          type: { type: 'string', enum: ['internal', 'external'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_audit_logs',
      description: 'IT Admin: the most recent administrative audit-log entries.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_credits',
      description: 'Client: the current user’s session-credit balance.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_payments',
      description:
        "The current user's own payments / invoices. Available to Client, Faculty, Program Head, and Academic Head.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_cancellation_requests',
      description:
        "The current user's own cancellation requests — status (pending/approved_no_strike/approved_with_strike/rejected/cancelled/auto_approved), whether it's refund-eligible, and review notes. Use for 'did my cancellation get approved?', 'is my refund coming?', 'what happened to my cancellation request'.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_reliability',
      description: 'Faculty: the current user’s reliability standing (demerits/strikes).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notifications',
      description: 'The current user’s notifications (unread + recent).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_schedule',
      description: 'Faculty: the current user’s teaching schedule (their classes this term).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule_reviews',
      description: 'Academic Head: class-schedule uploads pending review.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reports_summary',
      description: 'Building Admin: building dashboard stats / reports summary.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_maintenance',
      description: 'Building Admin: maintenance records / status overview.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_roles',
      description: 'IT Admin: the list of roles (use to resolve a role name to its roleId for assign/remove role).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reports',
      description: 'IT Admin: system report metrics.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_courses',
      description: "Program Head: list/search courses in the curriculum. Filter by 'search', 'department_code', 'term', or 'approval_status'.",
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          department_code: { type: 'string' },
          term: { type: 'string' },
          approval_status: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_curriculum_pending',
      description: "Program Head: curriculum batches / courses pending approval. Optionally filter by 'department_code'.",
      parameters: { type: 'object', properties: { department_code: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule_uploads',
      description: "Program Head: class-schedule uploads. Filter by 'status' (e.g. draft/submitted/published).",
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_professor_assignments',
      description: "Program Head / Academic Head: professor→section teaching assignments. Filter by 'status' or 'department_id'.",
      parameters: { type: 'object', properties: { status: { type: 'string' }, department_id: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_approved_schedules',
      description: "Program Head / Academic Head: the live/published class schedule. Filter by 'department_id', 'day_of_week', or 'unassigned'='true' for classes with no instructor.",
      parameters: { type: 'object', properties: { department_id: { type: 'string' }, day_of_week: { type: 'string' }, unassigned: { type: 'string', description: '"true" for classes with no instructor' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sections',
      description: "Program Head / Academic Head: list class sections. Optionally filter by 'courseCode'.",
      parameters: { type: 'object', properties: { courseCode: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upload_history',
      description: 'Program Head: recent course-upload history (batch imports).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_school_events',
      description: 'Program Head: school events this department has scheduled.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_departments',
      description: 'Academic Head: list academic departments.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rates',
      description: 'Building Admin: facility rental rates (pricing).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_equipment',
      description: "Building Admin: building equipment inventory. Filter by 'search' or 'status'.",
      parameters: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_hvac',
      description: "Building Admin: HVAC fixtures inventory & status. Filter by 'status'.",
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_issue_reports',
      description: "Building Admin: equipment issue reports to triage. Each has an id for dismiss_issue_report / convert_issue_report. Filter by 'status'.",
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_restricted_users',
      description: 'Building Admin: users under restriction/probation. Each has a user_id for restrict_user / place_on_probation / lift_building_restriction / end_building_probation / clear_violations.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_faq',
      description: 'Building Admin: the managed FAQ entries.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_building_bookings',
      description: "Building Admin: reservations across all facilities. Filter by 'search', 'status', or 'type' (standard|paid). Each has a booking_id.",
      parameters: {
        type: 'object',
        properties: { search: { type: 'string' }, status: { type: 'string' }, type: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_class_schedules',
      description:
        "Building Admin: the FIXED class schedule — recurring weekly classes (the timetable), NOT reservations/bookings. Use this when asked about classes, timetables, what's scheduled in a room, who teaches what, or professor schedules. Returns course, section, instructor, day, time, and room across all facilities. Filter by 'day_of_week' (0=Sun..6=Sat — use day_of_week from LIVE CONTEXT for 'today'), 'facility_id' (UUID from get_facility_status), 'department_id', 'academic_term_id', or 'unassigned' ('true' for classes with no instructor). For 'who has classes' or 'list professors': call with no filters and GROUP results by instructor_name in your response as a readable table.",
      parameters: {
        type: 'object',
        properties: {
          day_of_week: { type: 'string', description: '0=Sun..6=Sat; use day_of_week from LIVE CONTEXT for today' },
          facility_id: { type: 'string', description: 'facility UUID to scope to one room (from get_facility_status)' },
          department_id: { type: 'string', description: 'department UUID to filter by program (BSIT, BSCS, etc.)' },
          academic_term_id: { type: 'string', description: 'academic term UUID; omit for current active term' },
          unassigned: { type: 'string', description: 'set to "true" to show only classes with no instructor assigned' },
        },
      },
    },
  },
  // ── Building Admin extended tools (Phase 2-3) ──────────────────────
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description:
        "Building Admin: calendar events across all facilities — bookings, classes, maintenance, and events for a date range. Use for 'what's happening this week?', 'events on Friday', 'calendar for Room X'. Filter by facility_id, start_date, end_date (YYYY-MM-DD).",
      parameters: {
        type: 'object',
        properties: {
          facility_id: { type: 'string', description: 'facility UUID to scope to one room' },
          start_date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          end_date: { type: 'string', description: 'YYYY-MM-DD (default: 7 days from today)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_school_event_blocks',
      description:
        "Academic Head / Building Admin: school event and Exam Period blocks, grouped by submission. Each group has group_id, dates[], facilities[], block_category ('school_event'|'exam_period'), current_status ('pending'|'auto_approved'|'cancellation_requested'|'cancelled'|'completed'), created_by_name, and booking_ids (used by cancel_school_event and the approval actions). Filter by status (e.g. 'pending' for BA's approval queue, 'cancellation_requested' for AH's pending cancellations), block_category, facility_id, start_date/end_date. Use before proposing cancel_school_event or any approval action to find the right group_id. Limitations: cancel/delete is whole-group only (no partial-group cancel of e.g. just one facility); there is no edit/extend action, propose a new create_school_event for additional days instead; this lists already-created blocks, not general facility availability (use booking/calendar tools for that).",
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'auto_approved', 'cancellation_requested', 'cancelled', 'completed'], description: 'filter by group status' },
          block_category: { type: 'string', enum: ['school_event', 'exam_period'], description: 'filter by block type' },
          facility_id: { type: 'string', description: 'facility UUID to scope to one room' },
          start_date: { type: 'string', description: 'YYYY-MM-DD, filters groups with a date on/after this' },
          end_date: { type: 'string', description: 'YYYY-MM-DD, filters groups with a date on/before this' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_school_events',
      description:
        "Everyone: read-only, campus-wide view of active/upcoming School Event and Exam Period blocks -- 'is there an exam block coming up', 'will the gym be closed'. Unlike Program Head's get_school_events (that department's own submissions only), this covers every role's blocks campus-wide, but strips ids and requester names -- it cannot be used to propose a cancel. Defaults to currently-active (auto_approved) blocks only. Filter by status, block_category, facility_id, start_date/end_date.",
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'auto_approved', 'cancellation_requested', 'cancelled', 'completed'], description: 'filter by group status (default: auto_approved)' },
          block_category: { type: 'string', enum: ['school_event', 'exam_period'], description: 'filter by block type' },
          facility_id: { type: 'string', description: 'facility UUID to scope to one room' },
          start_date: { type: 'string', description: 'YYYY-MM-DD' },
          end_date: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reports_analytics',
      description:
        "Building Admin: analytics and reports — booking trends, revenue breakdown, utilization heatmap, department distribution. Use for 'how are we doing?', 'utilization rate', 'revenue this month', 'most popular rooms'. Filter by metric (utilization|revenue|bookings|departments) and period (week|month|semester).",
      parameters: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: ['utilization', 'revenue', 'bookings', 'departments'], description: 'type of analytics' },
          period: { type: 'string', enum: ['week', 'month', 'semester'], description: 'time period' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_directory',
      description:
        "Building Admin: search the personnel directory. Filter by 'search' (name/email), 'role' (faculty|program_head|academic_head|building_admin|maintenance), or 'category' (internal|external). Use for 'list all faculty', 'who are the maintenance staff?', 'show BSIT professors'. Returns name, role, department, status.",
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'name or email to filter by' },
          role: { type: 'string', description: 'role name to filter by' },
          category: { type: 'string', enum: ['internal', 'external'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_transactions',
      description:
        "Building Admin: payment and transaction records. Filter by 'status' (pending|completed|failed) or 'search' (reference, user name). Use for 'recent payments', 'pending payments', 'payment history'.",
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_emergency_requests',
      description:
        "Building Admin: pending emergency reschedule/cancellation requests from users. Use for 'any emergency requests?', 'show pending emergencies'. Filter by status (pending|approved|denied).",
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'denied'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_facility_reviews',
      description:
        "Building Admin: facility reviews and ratings from users. Use for 'what do people think of Room X?', 'facility ratings', 'show reviews'. Filter by facility_id.",
      parameters: {
        type: 'object',
        properties: {
          facility_id: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_change_requests',
      description: "Program Head / Academic Head: schedule change-requests. For Program Head: see your submitted requests and their status. For Academic Head: requests awaiting a decision (each has a request_id for decide_change_request). Filter by 'status'.",
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_special_events',
      description: "Academic Head: special-events queue awaiting review. Filter by 'status'.",
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  // ── Academic Head extended tools ───────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_all_bookings',
      description:
        "Academic Head: all reservations across all departments. Filter by 'search' (faculty name, reference), 'status' (pending|approved|flagged|cancelled|completed), 'department', 'date_from'/'date_to' (YYYY-MM-DD), 'sort' (date|status|score|department). Use for 'show all bookings', 'pending reservations', 'bookings this week'.",
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          status: { type: 'string' },
          department: { type: 'string' },
          date_from: { type: 'string', description: 'YYYY-MM-DD' },
          date_to: { type: 'string', description: 'YYYY-MM-DD' },
          sort: { type: 'string', enum: ['date', 'status', 'score', 'department'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_faculty_availability',
      description:
        "Program Head / Academic Head: all faculty with their busy_blocks (teaching, booking, proposed lineups). Use for 'faculty availability', 'who is free at this time', 'check professor conflicts', 'show my department faculty'. Filter by department_id.",
      parameters: {
        type: 'object',
        properties: {
          department_id: { type: 'string', description: 'department UUID to filter by' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_assignment_lineups',
      description:
        "Academic Head: professor assignment lineups (proposals from program heads to assign professors to classes). Filter by 'status' (pending|approved|rejected) and 'department_id'. Use for 'pending lineups', 'assignment proposals'.",
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          department_id: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule_history',
      description:
        "Academic Head: all class schedules including inactive/superseded versions. Use for 'schedule history', 'what changed in schedules', 'show all schedules'. Filter by department_id, day_of_week, search.",
      parameters: {
        type: 'object',
        properties: {
          department_id: { type: 'string' },
          day_of_week: { type: 'string' },
          search: { type: 'string', description: 'course code, section, or instructor name' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule_exceptions',
      description:
        "Academic Head: class schedule exceptions (voided/suspended classes, typically from school events). Filter by start_date and end_date (max 14 days). Use for 'what classes are suspended', 'schedule exceptions this week'.",
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'YYYY-MM-DD' },
          end_date: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_person',
      description:
        "Look up ONE person (faculty/staff/user) and see everything your role can about them in a single card: profile + roles + status, plus (where your role allows) their teaching schedule, their bookings/reservations, payments, and reliability standing. Pass whatever you know in 'search' — a name, email, employee ID, department, or a role phrase like 'academic head' or 'program head'. Matching is fuzzy: word order and middle initials don't matter (\"ricardo dela cruz\" still finds \"Ricardo J. Dela Cruz\"), so try it before telling the user you can't find someone. Use an exact 'user_id' only if you already have it.",
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: "name, email, employee ID, department, or role phrase (e.g. 'academic head'); fuzzy and word-order tolerant" },
          user_id: { type: 'string', description: 'exact user id, if already known' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_academic_terms',
      description: 'IT Admin: list academic terms (each has a term_id for set_active_term).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tech_equipment',
      description: "IT Admin: the IT-owned (tech) equipment inventory. Filter by 'search' or 'status'.",
      parameters: { type: 'object', properties: { search: { type: 'string' }, status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tech_reports',
      description: "IT Admin: tech-equipment issue reports. Each has an id for update_tech_report. Filter by 'status'.",
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_assignment_requests',
      description: "IT Admin: equipment assignment requests. Each has an id (request_id) for decide_assignment_request. Filter by 'status'.",
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pamo_equipment',
      description: "PAMO Officer: search the non-tech equipment inventory. Filter by 'search' (name), 'category', or 'status'.",
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          category: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pamo_attention',
      description: 'PAMO Officer: equipment that needs attention (low stock, damaged, or flagged).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pamo_equipment_stats',
      description: 'PAMO Officer: non-tech equipment inventory statistics (counts by category/status).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pamo_reports',
      description: 'PAMO Officer: asset-management reports summary.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_facility_warnings',
      description: 'Check which facilities have active warnings or issues. Use when asked about room problems, equipment issues, or facility conditions.',
      parameters: { type: 'object', properties: { facility_id: { type: 'string', description: 'optional facility UUID to scope to one facility' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule_reports',
      description: 'Building Admin: schedule issue reports to triage. Filter by status. Shows equipment type, tech/non-tech classification, HVAC flag. Each report has an id for update_schedule_report / escalate_schedule_report.',
      parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter by status: pending, under_review, resolved, dismissed, escalated' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_hvac_schedule_reports',
      description: 'Building Admin: HVAC-related schedule issue reports (air conditioning issues). Shows which rooms have AC problems.',
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_schedule_reports',
      description: 'Your filed schedule issue reports and their status. Shows pending, under_review, resolved, or dismissed.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule_report_logs',
      description: 'Activity log for a schedule issue report. Shows all status changes, who made them, and when.',
      parameters: { type: 'object', properties: { report_id: { type: 'string', description: 'The schedule report ID' } }, required: ['report_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule_report_attachments',
      description: 'Photo attachments for a schedule issue report. Shows evidence images uploaded by the reporter.',
      parameters: { type: 'object', properties: { report_id: { type: 'string', description: 'The schedule report ID' } }, required: ['report_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_facility_equipment',
      description: 'Equipment in a specific facility/room. Shows what equipment is available and its status.',
      parameters: { type: 'object', properties: { facility_id: { type: 'string', description: 'The facility UUID' } }, required: ['facility_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_refund_ledger',
      description:
        "Building Admin: all processed refunds with amounts, destinations, and who triggered each (AH-approved cancellation entitlement vs. a BA discretionary override). Filter by 'trigger_type' (cancellation_request_entitlement|ba_override), 'date_from'/'date_to'. Use for 'how much have we refunded', 'refunds this month', 'show override refunds'.",
      parameters: {
        type: 'object',
        properties: {
          trigger_type: { type: 'string', enum: ['cancellation_request_entitlement', 'ba_override'] },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_qr_codes',
      description:
        "Building Admin: the institution's configured QR payment codes (GCash, Maya, bank transfer, etc.), including which are active. Use for 'what QR codes do we have', 'is GCash still active', 'list our payment methods'.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cancellation_requests',
      description:
        "Academic Head: pending (or filtered by 'status': pending|approved_no_strike|approved_with_strike|rejected|all) cancellation requests awaiting review, including whether each is refund-eligible. Use for 'any cancellation requests?', 'pending cancellations', 'do I have refunds to approve'.",
      parameters: {
        type: 'object',
        properties: { status: { type: 'string' } },
      },
    },
  },
]

// All non-terminal data tools, keyed by name, for role-filtered assembly.
const TOOL_DEF_BY_NAME = new Map<string, ToolDefinition>(
  [...TOOL_DEFINITIONS, ...LOOKUP_TOOL_DEFINITIONS].map((d) => [d.function.name, d])
)

/**
 * Assemble the tool schemas exposed to the model for this caller: only the
 * capability's allowed tools, plus the always-on terminal emit_result.
 */
export function buildToolDefinitions(caps: RoleCapability): ToolDefinition[] {
  const defs: ToolDefinition[] = []
  for (const name of caps.tools) {
    const def = TOOL_DEF_BY_NAME.get(name)
    if (def) defs.push(def)
  }
  const terminal = TOOL_DEF_BY_NAME.get(TERMINAL_TOOL)
  if (terminal) defs.push(terminal)
  return defs
}

// ─── Internal GET proxy (role lookups) ─────────────────────────────────────────
/** Cap arrays to keep tool results small for the model. */
