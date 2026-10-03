/**
 * Guarded write-action registry for the AI Assistant.
 *
 * The model can only ever *propose* one of these actions (via the emit_result
 * envelope). Nothing here runs until the user clicks **Confirm** in chat, which
 * hits POST /api/ai/action → executeAction(). Each action is a thin, role-checked
 * proxy to the EXISTING endpoint that already owns the business rules, audit log
 * and its own authorization — so this layer never re-implements a mutation and
 * the underlying route is the final gate (triple gate: caps filter → this
 * allowedRoles check → the endpoint's own guard).
 *
 * @module backend/ai/actions
 */

import type { AssistantActionType } from './roleCapabilities'

export interface ActionContext {
  /** Forwarded so the proxied endpoint authenticates as the same user. */
  cookie: string | null
  /** Absolute origin of the current request, e.g. http://localhost:3000 */
  origin: string
  userId: string
  roles: string[]
}

export interface ActionResult {
  ok: boolean
  message: string
  data?: unknown
  status?: number
}

interface InternalRequest {
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  body?: Record<string, unknown>
}

interface ActionDef {
  allowedRoles: string[]
  required: string[]
  /**
   * 'high' = cascading/side-effecting but recoverable → the UI requires the user
   * to type `confirmPhrase` before executing. 'normal' = standard Confirm button.
   */
  risk?: 'normal' | 'high'
  /** Phrase the user must type to run a high-risk action (e.g. "PUBLISH"). */
  confirmPhrase?: string
  /** Optional param validation — returns an error message if params are invalid, null if OK. */
  validate?: (params: Record<string, unknown>) => string | null
  /** Human-readable confirmation summary (fallback if the model omits one). */
  describe(params: Record<string, unknown>): string
  /** Maps params → the existing endpoint to proxy. */
  request(params: Record<string, unknown>): InternalRequest
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

export const ACTIONS: Record<AssistantActionType, ActionDef> = {
  cancel_my_booking: {
    allowedRoles: ['external_client', 'faculty', 'program_head', 'academic_head', 'building_admin'],
    required: ['booking_id'],
    describe: (p) => `Cancel your booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/bookings/${encodeURIComponent(str(p.booking_id))}/cancel`,
      body: { reason: str(p.reason) || 'Cancelled via assistant' },
    }),
  },

  approve_booking: {
    allowedRoles: ['academic_head'],
    required: ['booking_id', 'reason'],
    describe: (p) => `Approve booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/academic-head/review-booking',
      body: { booking_id: str(p.booking_id), action: 'approve', reason: str(p.reason) },
    }),
  },

  reject_booking: {
    allowedRoles: ['academic_head'],
    required: ['booking_id', 'reason'],
    describe: (p) => `Reject booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/academic-head/review-booking',
      body: {
        booking_id: str(p.booking_id),
        action: 'reject',
        reason: str(p.reason),
        ...(p.reason_code ? { reason_code: str(p.reason_code) } : {}),
      },
    }),
  },

  approve_paid_booking: {
    allowedRoles: ['building_admin'],
    required: ['booking_id'],
    describe: (p) => `Approve paid booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/admin/building/bookings/${encodeURIComponent(str(p.booking_id))}`,
      body: { action: 'approve', ...(p.notes ? { notes: str(p.notes) } : {}) },
    }),
  },

  verify_qr_payment: {
    allowedRoles: ['building_admin'],
    required: ['payment_id'],
    describe: (p) => `Verify QR payment ${str(p.payment_reference) || str(p.payment_id)} (ref: ${str(p.reference_number)})`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/building/payments/${encodeURIComponent(str(p.payment_id))}/qr-verify`,
      body: {},
    }),
  },

  reject_qr_payment: {
    allowedRoles: ['building_admin'],
    required: ['payment_id', 'reason'],
    describe: (p) => `Reject QR payment proof for ${str(p.payment_reference) || str(p.payment_id)}: ${str(p.reason)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/building/payments/${encodeURIComponent(str(p.payment_id))}/qr-reject`,
      body: { reason: str(p.reason) },
    }),
  },

  confirm_entitlement_refund: {
    allowedRoles: ['building_admin'],
    required: ['payment_id', 'cancellation_request_id'],
    describe: (p) => `Confirm full refund sent for ${str(p.payment_reference) || str(p.payment_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/building/payments/${encodeURIComponent(str(p.payment_id))}/refunds`,
      body: {
        trigger_type: 'cancellation_request_entitlement',
        cancellation_request_id: str(p.cancellation_request_id),
        ...(p.destination_name ? { destination_name: str(p.destination_name) } : {}),
        ...(p.destination_contact_number ? { destination_contact_number: str(p.destination_contact_number) } : {}),
        ...(p.reference_number ? { reference_number: str(p.reference_number) } : {}),
        ...(p.screenshot_url ? { screenshot_url: str(p.screenshot_url) } : {}),
      },
    }),
    risk: 'high',
    confirmPhrase: 'REFUND',
  },

  override_refund: {
    allowedRoles: ['building_admin'],
    required: ['payment_id', 'amount', 'justification_note', 'destination_name', 'destination_contact_number'],
    describe: (p) =>
      `Discretionary refund of ₱${str(p.amount)} for ${str(p.payment_reference) || str(p.payment_id)} to ${str(p.destination_name)} — bypasses Academic Head review`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/building/payments/${encodeURIComponent(str(p.payment_id))}/refunds`,
      body: {
        trigger_type: 'ba_override',
        amount: Number(p.amount),
        justification_note: str(p.justification_note),
        destination_name: str(p.destination_name),
        destination_contact_number: str(p.destination_contact_number),
        ...(p.reference_number ? { reference_number: str(p.reference_number) } : {}),
        ...(p.screenshot_url ? { screenshot_url: str(p.screenshot_url) } : {}),
      },
    }),
    risk: 'high',
    confirmPhrase: 'OVERRIDE REFUND',
  },

  set_payment_mode: {
    allowedRoles: ['building_admin'],
    required: ['mode'],
    describe: (p) => `Switch the institution's active payment method to "${str(p.mode)}"`,
    request: (p) => ({
      method: 'PATCH',
      path: '/api/settings/payment-policy',
      body: { payment_method_mode: str(p.mode) },
    }),
    validate: (p) => (['paymongo', 'qr_after_approval', 'qr_at_submission'].includes(str(p.mode)) ? null : 'mode must be paymongo, qr_after_approval, or qr_at_submission'),
    risk: 'high',
    confirmPhrase: 'SWITCH PAYMENT METHOD',
  },

  set_user_status: {
    allowedRoles: ['it_admin'],
    required: ['user_id', 'status'],
    describe: (p) => `Set user ${str(p.user_name) || str(p.user_id)} status to "${str(p.status)}"`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/admin/users/${encodeURIComponent(str(p.user_id))}/status`,
      body: { status: str(p.status) },
    }),
  },

  set_active_term: {
    allowedRoles: ['it_admin'],
    required: ['term_id'],
    risk: 'high',
    confirmPhrase: 'ACTIVATE',
    describe: (p) => `Set ${str(p.term_name) || str(p.term_id)} as the active academic term`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/academic-terms/${encodeURIComponent(str(p.term_id))}/set-active`,
    }),
  },

  // ─── Self-service (faculty / client / staff on their own records) ──────────────
  accept_alternative: {
    allowedRoles: ['external_client', 'faculty', 'program_head', 'academic_head', 'building_admin'],
    required: ['booking_id'],
    describe: (p) => `Accept the proposed alternative slot for booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/bookings/${encodeURIComponent(str(p.booking_id))}/accept-alternative`,
      body: { accept: true },
    }),
  },
  submit_appeal: {
    allowedRoles: ['external_client', 'faculty', 'program_head', 'academic_head', 'building_admin'],
    required: ['appeal_reason'],
    describe: () => 'Submit an appeal to lift your account restriction',
    request: (p) => ({ method: 'POST', path: '/api/bookings/appeal', body: { appeal_reason: str(p.appeal_reason) } }),
  },
  request_reliability_reset: {
    allowedRoles: ['faculty', 'program_head', 'academic_head'],
    required: ['reason'],
    describe: () => 'Request a reliability-score reset for your account',
    request: (p) => ({
      method: 'POST',
      path: '/api/users/reliability-score/request-reset',
      body: { reason: str(p.reason), ...(p.type ? { type: str(p.type) } : {}) },
    }),
  },

  // ─── Client / Faculty self-service ─────────────────────────────────────────────
  emergency_cancel_my_booking: {
    allowedRoles: ['external_client', 'faculty', 'program_head', 'academic_head', 'building_admin'],
    required: ['booking_id', 'reason'],
    describe: (p) => `Emergency-cancel your booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/bookings/${encodeURIComponent(str(p.booking_id))}/self-emergency-cancel`,
      body: { reason: str(p.reason) },
    }),
  },
  report_equipment_issue: {
    allowedRoles: ['external_client', 'faculty', 'program_head', 'academic_head'],
    required: ['category', 'description'],
    describe: (p) => `Report an equipment issue (${str(p.category)})`,
    request: (p) => ({
      method: 'POST',
      path: '/api/equipment-reports',
      body: {
        category: str(p.category),
        description: str(p.description),
        ...(p.equipment_id ? { equipment_id: str(p.equipment_id) } : {}),
        ...(p.facility_id ? { facility_id: str(p.facility_id) } : {}),
      },
    }),
  },
  submit_facility_review: {
    allowedRoles: ['external_client', 'faculty', 'program_head'],
    required: ['facility_id', 'rating'],
    describe: (p) => `Submit a ${str(p.rating)}-star review for the facility`,
    request: (p) => ({
      method: 'POST',
      path: `/api/facilities/${encodeURIComponent(str(p.facility_id))}/reviews`,
      body: { rating: Number(p.rating) || 0, ...(p.comment ? { comment: str(p.comment) } : {}) },
    }),
  },
  file_schedule_report: {
    allowedRoles: ['faculty', 'program_head', 'academic_head', 'building_admin'],
    required: ['category', 'what_happened', 'schedule_type', 'schedule_id'],
    describe: (p) => `Report a schedule issue (${str(p.category)})`,
    request: (p) => ({
      method: 'POST',
      path: '/api/schedule-reports',
      body: {
        schedule_type: str(p.schedule_type),
        schedule_id: str(p.schedule_id),
        category: str(p.category),
        what_happened: str(p.what_happened),
        ...(p.facility_id ? { facility_id: str(p.facility_id) } : {}),
        ...(p.what_to_correct ? { what_to_correct: str(p.what_to_correct) } : {}),
      },
    }),
  },
  update_schedule_report: {
    allowedRoles: ['building_admin'],
    required: ['report_id', 'status'],
    describe: (p) => `Update schedule report ${str(p.report_id)} to status '${str(p.status)}'`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/admin/schedule-reports/${encodeURIComponent(str(p.report_id))}`,
      body: {
        status: str(p.status),
        ...(p.resolution_notes ? { resolution_notes: str(p.resolution_notes) } : {}),
      },
    }),
  },
  update_my_schedule_report: {
    allowedRoles: ['faculty', 'program_head', 'academic_head'],
    required: ['report_id'],
    describe: (p) => `Update your schedule report ${str(p.report_id)}${p.what_to_correct ? ` — adding correction details` : ''}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/schedule-reports/${encodeURIComponent(str(p.report_id))}`,
      body: {
        ...(p.status ? { status: str(p.status) } : {}),
        ...(p.what_to_correct ? { what_to_correct: str(p.what_to_correct) } : {}),
      },
    }),
  },
  notify_faculty: {
    allowedRoles: ['building_admin'],
    required: ['facility_id', 'message'],
    describe: (p) => `Send notification to faculty in facility ${str(p.facility_name) || str(p.facility_id)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/admin/notifications/broadcast',
      body: { facility_id: str(p.facility_id), message: str(p.message) },
    }),
  },
  escalate_schedule_report: {
    allowedRoles: ['building_admin'],
    required: ['report_id', 'facility_id', 'category', 'description'],
    describe: (p) => `Escalate schedule report ${str(p.report_id)} to equipment pipeline`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/schedule-reports/${encodeURIComponent(str(p.report_id))}/escalate`,
      body: {
        facility_id: str(p.facility_id),
        category: str(p.category),
        description: str(p.description),
        ...(p.equipment_id ? { equipment_id: str(p.equipment_id) } : {}),
        ...(p.is_tech !== undefined ? { is_tech: p.is_tech } : {}),
      },
    }),
  },

  // ─── Program Head — curriculum batch lifecycle ─────────────────────────────────
  submit_curriculum_batch: {
    allowedRoles: ['program_head'],
    required: ['batch_id'],
    describe: (p) => `Submit curriculum batch ${str(p.batch_name) || str(p.batch_id)} for approval`,
    request: (p) => ({ method: 'POST', path: `/api/courses/batch/${encodeURIComponent(str(p.batch_id))}/submit` }),
  },
  publish_curriculum_batch: {
    allowedRoles: ['program_head'],
    required: ['batch_id'],
    risk: 'high',
    confirmPhrase: 'PUBLISH',
    describe: (p) => `Publish curriculum batch ${str(p.batch_name) || str(p.batch_id)} — makes its courses live`,
    request: (p) => ({ method: 'POST', path: `/api/courses/batch/${encodeURIComponent(str(p.batch_id))}/publish` }),
  },
  request_delete_curriculum_batch: {
    allowedRoles: ['program_head'],
    required: ['batch_id', 'reason'],
    describe: (p) => `Request deletion of curriculum batch ${str(p.batch_name) || str(p.batch_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/courses/batch/${encodeURIComponent(str(p.batch_id))}/request-delete`,
      body: { reason: str(p.reason) },
    }),
  },

  // ─── Program Head — schedule uploads & school events ──────────────────────────
  submit_schedule_upload: {
    allowedRoles: ['program_head'],
    required: ['upload_id'],
    describe: (p) => `Submit schedule upload ${str(p.upload_id)} for academic head review`,
    request: (p) => ({
      method: 'POST',
      path: `/api/schedules/uploads/${encodeURIComponent(str(p.upload_id))}/submit`,
    }),
  },
  create_school_event_ph: {
    allowedRoles: ['program_head'],
    required: ['event_name', 'facility_ids', 'booking_date'],
    risk: 'high',
    confirmPhrase: 'CREATE EVENT',
    describe: (p) => `Create school event '${str(p.event_name)}' — will require academic head approval`,
    request: (p) => ({
      method: 'POST',
      path: '/api/program-head/schedule-events',
      body: {
        event_name: str(p.event_name),
        booking_date: str(p.booking_date),
        start_time: str(p.start_time) || '00:00',
        end_time: str(p.end_time) || '23:59',
        facility_ids: Array.isArray(p.facility_ids) ? p.facility_ids : [],
      },
    }),
  },
  cancel_school_event_ph: {
    allowedRoles: ['program_head'],
    required: ['event_id'],
    describe: (p) => `Cancel your school event request ${str(p.event_name) || str(p.event_id)}`,
    request: (p) => ({
      method: 'DELETE',
      path: `/api/program-head/schedule-events/${encodeURIComponent(str(p.event_id))}`,
    }),
  },
  submit_schedule_change_request: {
    allowedRoles: ['program_head'],
    required: ['change_type', 'reason'],
    describe: (p) => `Submit a schedule change request (${str(p.change_type)}): ${str(p.reason).slice(0, 50)}`,
    request: (p) => {
      const body: Record<string, unknown> = {
        change_type: str(p.change_type),
        reason: str(p.reason),
      }
      if (p.original_schedule_id) body.original_schedule_id = str(p.original_schedule_id)
      if (p.new_course_code) body.new_course_code = str(p.new_course_code)
      if (p.new_course_name) body.new_course_name = str(p.new_course_name)
      if (p.new_section) body.new_section = str(p.new_section)
      if (p.new_instructor_name) body.new_instructor_name = str(p.new_instructor_name)
      if (p.new_day_of_week !== undefined) body.new_day_of_week = Number(p.new_day_of_week)
      if (p.new_start_time) body.new_start_time = str(p.new_start_time)
      if (p.new_end_time) body.new_end_time = str(p.new_end_time)
      if (p.new_facility_id) body.new_facility_id = str(p.new_facility_id)
      return { method: 'POST', path: '/api/schedules/change-requests', body }
    },
  },

  // ─── Academic Head ─────────────────────────────────────────────────────────────
  cancel_booking: {
    allowedRoles: ['academic_head'],
    required: ['booking_id', 'reason'],
    describe: (p) => `Cancel booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/academic-head/cancel-booking',
      body: { booking_id: str(p.booking_id), reason: str(p.reason) },
    }),
  },
  decide_reliability_request: {
    allowedRoles: ['academic_head'],
    required: ['request_id', 'decision'],
    describe: (p) => `${str(p.decision) === 'approve' ? 'Approve' : 'Decline'} a reliability-reset request`,
    request: (p) => ({
      method: 'POST',
      path: `/api/academic-head/reliability/requests/${encodeURIComponent(str(p.request_id))}/decision`,
      body: { decision: str(p.decision) === 'approve' ? 'approve' : 'decline', ...(p.notes ? { notes: str(p.notes) } : {}) },
    }),
  },
  reset_reliability: {
    allowedRoles: ['academic_head'],
    required: ['user_id'],
    risk: 'high',
    confirmPhrase: 'RESET',
    describe: (p) => `Reset the reliability score of ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/academic-head/reliability/${encodeURIComponent(str(p.user_id))}/reset`,
      body: { ...(p.notes ? { notes: str(p.notes) } : {}) },
    }),
  },
  publish_schedule_upload: {
    allowedRoles: ['academic_head'],
    required: ['upload_id'],
    risk: 'high',
    confirmPhrase: 'PUBLISH',
    describe: (p) => `Publish schedule upload ${str(p.upload_id)} to the live calendar — this AUTO-CANCELS overlapping bookings`,
    request: (p) => ({ method: 'POST', path: `/api/schedules/uploads/${encodeURIComponent(str(p.upload_id))}/publish` }),
  },

  // ─── Academic Head — curriculum approval queue + oversight ─────────────────────
  approve_curriculum_batch: {
    allowedRoles: ['academic_head'],
    required: ['batch_id'],
    describe: (p) => `Approve curriculum batch ${str(p.batch_name) || str(p.batch_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/courses/approval/batch/${encodeURIComponent(str(p.batch_id))}/approve` }),
  },
  reject_curriculum_batch: {
    allowedRoles: ['academic_head'],
    required: ['batch_id', 'reason'],
    describe: (p) => `Reject curriculum batch ${str(p.batch_name) || str(p.batch_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/courses/approval/batch/${encodeURIComponent(str(p.batch_id))}/reject`,
      body: { reason: str(p.reason) },
    }),
  },
  send_back_curriculum_batch: {
    allowedRoles: ['academic_head'],
    required: ['batch_id', 'notes'],
    describe: (p) => `Send curriculum batch ${str(p.batch_name) || str(p.batch_id)} back for revision`,
    request: (p) => ({
      method: 'POST',
      path: `/api/courses/approval/batch/${encodeURIComponent(str(p.batch_id))}/send-back`,
      body: { notes: str(p.notes) },
    }),
  },
  decide_change_request: {
    allowedRoles: ['academic_head'],
    required: ['request_id', 'decision'],
    describe: (p) => `${str(p.decision) === 'approve' ? 'Approve' : 'Reject'} schedule change-request ${str(p.request_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/schedules/change-requests/review/${encodeURIComponent(str(p.request_id))}`,
      body: { action: str(p.decision) === 'approve' ? 'approve' : 'reject', ...(p.notes ? { notes: str(p.notes) } : {}) },
    }),
  },
  batch_approve_reviews: {
    allowedRoles: ['academic_head'],
    required: ['booking_ids'],
    risk: 'high',
    confirmPhrase: 'APPROVE',
    describe: (p) => {
      const n = Array.isArray(p.booking_ids) ? p.booking_ids.length : 0
      return `Batch-approve ${n} booking review${n === 1 ? '' : 's'}`
    },
    request: (p) => ({
      method: 'POST',
      path: '/api/academic-head/mismatch-reviews/batch-approve',
      body: { booking_ids: Array.isArray(p.booking_ids) ? p.booking_ids : [], ...(p.reviewer_notes ? { reviewer_notes: str(p.reviewer_notes) } : {}) },
    }),
  },
  // Academic Head — schedule management
  approve_schedule_upload: {
    allowedRoles: ['academic_head'],
    required: ['upload_id'],
    describe: (p) => `Approve schedule upload ${str(p.upload_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/schedules/uploads/${encodeURIComponent(str(p.upload_id))}/publish` }),
  },
  reject_schedule_upload: {
    allowedRoles: ['academic_head'],
    required: ['upload_id'],
    describe: (p) => `Reject/rollback schedule upload ${str(p.upload_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/schedules/review/${encodeURIComponent(str(p.upload_id))}/rollback` }),
  },
  create_school_event: {
    // The endpoint (/api/academic-head/schedule-events) guards with
    // requireAcademicHeadOrBuildingAdmin, so the building admin is authorized here too.
    // The server decides pending-vs-auto_approved from the real session role (§5) — this
    // layer never branches on role for that, only describe()'s copy stays honest for both.
    allowedRoles: ['academic_head', 'building_admin'],
    required: ['event_name'],
    validate: (p) => {
      const hasDates = (Array.isArray(p.dates) && p.dates.length > 0) || !!p.start_date
      if (!hasDates) return 'At least one date (start_date, or dates[]) is required'
      const hasFacilities = p.all_facilities === true || (Array.isArray(p.facility_ids) && p.facility_ids.length > 0) || !!p.facility_id
      if (!hasFacilities) return 'Specify facility_ids, facility_id, or all_facilities: true'
      return null
    },
    risk: 'high',
    confirmPhrase: 'CREATE EVENT',
    describe: (p) =>
      `Propose school event '${str(p.event_name)}' — Building Admin submissions take effect immediately; Academic Head submissions are sent to Building Admin for approval first.`,
    request: (p) => {
      const dates: string[] = Array.isArray(p.dates) && p.dates.length > 0 ? (p.dates as string[]) : p.start_date ? [str(p.start_date)] : []
      const body: Record<string, unknown> = {
        event_name: str(p.event_name),
        mode: p.mode === 'exam_period' ? 'exam_period' : 'school_event',
        dates,
      }
      if (p.all_facilities === true) {
        body.all_facilities = true
      } else if (Array.isArray(p.facility_ids) && p.facility_ids.length > 0) {
        body.facility_ids = p.facility_ids
      } else if (p.facility_id) {
        body.facility_ids = [str(p.facility_id)]
      }
      if (p.start_time) body.start_time = str(p.start_time)
      if (p.end_time) body.end_time = str(p.end_time)
      return { method: 'POST', path: '/api/academic-head/schedule-events', body }
    },
  },
  cancel_school_event: {
    // group_id (new grouped rows) -> PATCH the group endpoint; the server resolves
    // immediate-vs-requested cancellation from the real role (§5). event_id (legacy,
    // Program-Head-originated, ungrouped) -> unchanged DELETE on the single-row endpoint.
    allowedRoles: ['academic_head', 'building_admin'],
    required: [],
    validate: (p) => {
      const hasGroup = !!p.group_id
      const hasEvent = !!p.event_id
      if (hasGroup === hasEvent) return 'Specify exactly one of group_id or event_id'
      return null
    },
    risk: 'high',
    confirmPhrase: 'CANCEL EVENT',
    describe: (p) =>
      `Cancel school event ${str(p.event_name) || str(p.group_id) || str(p.event_id)} — Building Admin's cancellation is immediate; Academic Head's is sent to Building Admin to confirm.`,
    request: (p) =>
      p.group_id
        ? {
            method: 'PATCH',
            path: `/api/academic-head/schedule-events/group/${encodeURIComponent(str(p.group_id))}`,
            body: { action: 'request_cancellation' },
          }
        : { method: 'DELETE', path: `/api/academic-head/schedule-events/${encodeURIComponent(str(p.event_id))}` },
  },
  approve_school_event_request: {
    allowedRoles: ['building_admin'],
    required: ['group_id'],
    risk: 'high',
    confirmPhrase: 'APPROVE EVENT',
    describe: (p) => `Approve the school event request ${str(p.event_name) || str(p.group_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/academic-head/schedule-events/group/${encodeURIComponent(str(p.group_id))}`,
      body: { action: 'approve' },
    }),
  },
  reject_school_event_request: {
    allowedRoles: ['building_admin'],
    required: ['group_id', 'reason'],
    risk: 'high',
    confirmPhrase: 'REJECT EVENT',
    describe: (p) => `Reject the school event request ${str(p.event_name) || str(p.group_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/academic-head/schedule-events/group/${encodeURIComponent(str(p.group_id))}`,
      body: { action: 'reject', reason: str(p.reason) },
    }),
  },
  confirm_school_event_cancellation: {
    allowedRoles: ['building_admin'],
    required: ['group_id'],
    risk: 'high',
    confirmPhrase: 'CONFIRM CANCELLATION',
    describe: (p) => `Confirm cancellation of ${str(p.event_name) || str(p.group_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/academic-head/schedule-events/group/${encodeURIComponent(str(p.group_id))}`,
      body: { action: 'confirm_cancellation' },
    }),
  },
  decline_school_event_cancellation: {
    allowedRoles: ['building_admin'],
    required: ['group_id'],
    risk: 'high',
    confirmPhrase: 'DECLINE CANCELLATION',
    describe: (p) => `Decline the cancellation request for ${str(p.event_name) || str(p.group_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/academic-head/schedule-events/group/${encodeURIComponent(str(p.group_id))}`,
      body: { action: 'decline_cancellation' },
    }),
  },
  withdraw_school_event_request: {
    // The server enforces "own group only" -- this layer doesn't need an extra check.
    allowedRoles: ['academic_head', 'building_admin'],
    required: ['group_id'],
    risk: 'high',
    confirmPhrase: 'WITHDRAW EVENT',
    describe: (p) => `Withdraw the school event request ${str(p.event_name) || str(p.group_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/academic-head/schedule-events/group/${encodeURIComponent(str(p.group_id))}`,
      body: { action: 'withdraw' },
    }),
  },
  create_academic_term: {
    allowedRoles: ['academic_head', 'it_admin'],
    required: ['term_name', 'term_code', 'academic_year', 'term_type', 'start_date', 'end_date'],
    describe: (p) => `Create academic term ${str(p.term_name)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/admin/academic-terms',
      body: { term_name: str(p.term_name), term_code: str(p.term_code), academic_year: str(p.academic_year), term_type: str(p.term_type), start_date: str(p.start_date), end_date: str(p.end_date) },
    }),
  },
  delete_booking: {
    allowedRoles: ['academic_head'],
    required: ['booking_id'],
    risk: 'high',
    confirmPhrase: 'DELETE',
    describe: (p) => `Permanently delete booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({ method: 'DELETE', path: `/api/academic-head/bookings/${encodeURIComponent(str(p.booking_id))}` }),
  },
  assign_professor: {
    allowedRoles: ['academic_head', 'program_head'],
    required: ['schedule_id', 'new_instructor_id', 'new_instructor_name'],
    describe: (p) => `Assign ${str(p.new_instructor_name)} to class schedule ${str(p.schedule_id)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/schedules/reassign',
      body: { schedule_id: str(p.schedule_id), new_instructor_id: str(p.new_instructor_id), new_instructor_name: str(p.new_instructor_name), action: 'reassign' },
    }),
  },
  unassign_professor: {
    allowedRoles: ['academic_head', 'program_head'],
    required: ['schedule_id'],
    describe: (p) => `Unassign professor from class schedule ${str(p.schedule_id)}`,
    request: (p) => ({ method: 'POST', path: '/api/schedules/reassign', body: { schedule_id: str(p.schedule_id), action: 'unassign' } }),
  },
  approve_assignment_lineup: {
    allowedRoles: ['academic_head'],
    required: ['lineup_id'],
    describe: (p) => `Approve professor assignment lineup ${str(p.lineup_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/schedules/assignments/review/${encodeURIComponent(str(p.lineup_id))}`, body: { action: 'approve' } }),
  },
  reject_assignment_lineup: {
    allowedRoles: ['academic_head'],
    required: ['lineup_id', 'notes'],
    describe: (p) => `Reject professor assignment lineup ${str(p.lineup_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/schedules/assignments/review/${encodeURIComponent(str(p.lineup_id))}`, body: { action: 'reject', notes: str(p.notes) } }),
  },
  edit_schedule: {
    allowedRoles: ['academic_head', 'building_admin'],
    required: ['schedule_id'],
    describe: (p) => `Edit class schedule ${str(p.schedule_id)}`,
    request: (p) => {
      const body: Record<string, unknown> = {}
      if (p.instructor_name) body.instructor_name = str(p.instructor_name)
      if (p.facility_id) body.facility_id = str(p.facility_id)
      if (p.day_of_week !== undefined) body.day_of_week = Number(p.day_of_week)
      if (p.start_time) body.start_time = str(p.start_time)
      if (p.end_time) body.end_time = str(p.end_time)
      if (p.reason) body.reason = str(p.reason)
      return { method: 'PATCH', path: `/api/schedules/manage/${encodeURIComponent(str(p.schedule_id))}`, body }
    },
  },
  create_schedule: {
    allowedRoles: ['academic_head'],
    required: ['course_code', 'course_name', 'section', 'day_of_week', 'start_time', 'end_time', 'facility_id'],
    describe: (p) => `Create class schedule for ${str(p.course_code)} ${str(p.section)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/schedules/all',
      body: {
        course_code: str(p.course_code), course_name: str(p.course_name), section: str(p.section),
        day_of_week: Number(p.day_of_week), start_time: str(p.start_time), end_time: str(p.end_time), facility_id: str(p.facility_id),
        ...(p.instructor_id ? { instructor_id: str(p.instructor_id), instructor_name: str(p.instructor_name) } : {}),
        ...(p.department_id ? { department_id: str(p.department_id) } : {}),
      },
    }),
  },
  deactivate_schedule: {
    allowedRoles: ['academic_head'],
    required: ['schedule_id'],
    describe: (p) => `Deactivate class schedule ${str(p.schedule_id)}`,
    request: (p) => ({ method: 'DELETE', path: `/api/schedules/manage/${encodeURIComponent(str(p.schedule_id))}` }),
  },

  // ─── Building Admin ──────────────────────────────────────────────────────────────
  reject_paid_booking: {
    allowedRoles: ['building_admin'],
    required: ['booking_id'],
    describe: (p) => `Reject paid booking ${str(p.booking_reference) || str(p.booking_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/admin/building/bookings/${encodeURIComponent(str(p.booking_id))}`,
      body: { action: 'reject', ...(p.notes ? { notes: str(p.notes) } : {}) },
    }),
  },
  cancel_building_booking: {
    allowedRoles: ['building_admin'],
    required: ['booking_id'],
    risk: 'high',
    confirmPhrase: 'CANCEL',
    describe: (p) => `Cancel booking ${str(p.booking_reference) || str(p.booking_id)} (building admin)`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/admin/building/bookings/${encodeURIComponent(str(p.booking_id))}`,
      body: { action: 'cancel', ...(p.notes ? { notes: str(p.notes) } : {}) },
    }),
  },

  // ─── Building Admin — report triage + restricted users ─────────────────────────
  dismiss_issue_report: {
    allowedRoles: ['building_admin'],
    required: ['report_id'],
    describe: (p) => `Dismiss equipment issue report ${str(p.report_id)}`,
    request: (p) => ({ method: 'PATCH', path: `/api/admin/building/issue-reports/${encodeURIComponent(str(p.report_id))}/dismiss` }),
  },
  convert_issue_report: {
    allowedRoles: ['building_admin'],
    required: ['report_id'],
    describe: (p) => `Convert issue report ${str(p.report_id)} into a maintenance ticket`,
    request: (p) => ({ method: 'POST', path: `/api/admin/building/issue-reports/${encodeURIComponent(str(p.report_id))}/convert` }),
  },
  lift_building_restriction: {
    allowedRoles: ['building_admin'],
    required: ['user_id'],
    risk: 'high',
    confirmPhrase: 'LIFT',
    describe: (p) => `Lift the restriction on ${str(p.user_name) || str(p.user_id)} (moves them to probation)`,
    request: (p) => ({ method: 'POST', path: `/api/admin/building/restricted-users/${encodeURIComponent(str(p.user_id))}/lift` }),
  },
  end_building_probation: {
    allowedRoles: ['building_admin'],
    required: ['user_id'],
    describe: (p) => `End probation for ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/admin/building/restricted-users/${encodeURIComponent(str(p.user_id))}/end-probation` }),
  },
  clear_violations: {
    allowedRoles: ['building_admin'],
    required: ['user_id'],
    risk: 'high',
    confirmPhrase: 'CLEAR',
    describe: (p) => `Clear all violations for ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/admin/building/restricted-users/${encodeURIComponent(str(p.user_id))}/clear-violations` }),
  },
  restrict_user: {
    allowedRoles: ['building_admin'],
    required: ['user_id', 'reason'],
    risk: 'high',
    confirmPhrase: 'RESTRICT',
    describe: (p) => `Restrict ${str(p.user_name) || str(p.user_id)} — block all bookings. Reason: ${str(p.reason)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/building/restricted-users/${encodeURIComponent(str(p.user_id))}/enforce`,
      body: { status: 'restricted', reason: str(p.reason) },
    }),
  },
  place_on_probation: {
    allowedRoles: ['building_admin'],
    required: ['user_id', 'reason'],
    risk: 'high',
    confirmPhrase: 'PROBATION',
    describe: (p) => `Place ${str(p.user_name) || str(p.user_id)} on probation — bookings require manual approval. Reason: ${str(p.reason)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/building/restricted-users/${encodeURIComponent(str(p.user_id))}/enforce`,
      body: { status: 'probation', reason: str(p.reason) },
    }),
  },
  // Building Admin — FAQ, maintenance, emergency, equipment
  create_faq: {
    allowedRoles: ['building_admin'],
    required: ['question', 'answer'],
    describe: (p) => `Create FAQ: ${str(p.question).slice(0, 50)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/faq/admin',
      body: { question: str(p.question), answer: str(p.answer), ...(p.category ? { category: str(p.category) } : {}), ...(p.role_tags ? { role_tags: p.role_tags } : {}) },
    }),
  },
  edit_faq: {
    allowedRoles: ['building_admin'],
    required: ['faq_id'],
    describe: (p) => `Edit FAQ ${str(p.faq_id)}`,
    request: (p) => {
      const body: Record<string, unknown> = {}
      if (p.question) body.question = str(p.question)
      if (p.answer) body.answer = str(p.answer)
      if (p.category) body.category = str(p.category)
      if (p.is_active !== undefined) body.isActive = p.is_active
      return { method: 'PATCH', path: `/api/faq/${encodeURIComponent(str(p.faq_id))}`, body }
    },
  },
  delete_faq: {
    allowedRoles: ['building_admin'],
    required: ['faq_id'],
    describe: (p) => `Delete FAQ ${str(p.faq_id)}`,
    request: (p) => ({ method: 'DELETE', path: `/api/faq/${encodeURIComponent(str(p.faq_id))}` }),
  },
  create_maintenance: {
    allowedRoles: ['building_admin'],
    required: ['type', 'target_id', 'target_name', 'schedule_date'],
    describe: (p) => `Schedule maintenance for ${str(p.target_name)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/admin/building/maintenance',
      body: { type: str(p.type), target_id: str(p.target_id), target_name: str(p.target_name), schedule_date: str(p.schedule_date), ...(p.technician ? { technician: str(p.technician) } : {}), ...(p.notes ? { notes: str(p.notes) } : {}) },
    }),
  },
  approve_emergency_reschedule: {
    allowedRoles: ['building_admin'],
    required: ['request_id'],
    risk: 'high',
    confirmPhrase: 'APPROVE',
    describe: (p) => `Approve emergency reschedule request ${str(p.request_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/admin/building/emergency-reschedule-requests/${encodeURIComponent(str(p.request_id))}/approve` }),
  },
  decline_emergency_reschedule: {
    allowedRoles: ['building_admin'],
    required: ['request_id'],
    describe: (p) => `Decline emergency reschedule request ${str(p.request_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/building/emergency-reschedule-requests/${encodeURIComponent(str(p.request_id))}/decline`,
      ...(p.notes ? { body: { notes: str(p.notes) } } : {}),
    }),
  },
  approve_assignment_request: {
    allowedRoles: ['building_admin', 'it_admin'],
    required: ['request_id', 'status'],
    describe: (p) => `${str(p.status) === 'approved' ? 'Approve' : 'Deny'} equipment assignment request ${str(p.request_id)}`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/equipment-assignment-requests/${encodeURIComponent(str(p.request_id))}`,
      body: { status: str(p.status), ...(p.statusNote ? { statusNote: str(p.statusNote) } : {}) },
    }),
  },

  // ─── Building Admin — rental facility management ─────────────────────────────
  toggle_facility_rental: {
    allowedRoles: ['building_admin'],
    required: ['facility_id', 'is_available_for_rental'],
    describe: (p) => `${p.is_available_for_rental ? 'Enable' : 'Disable'} rental for ${str(p.facility_name) || str(p.facility_id)}`,
    request: (p) => ({
      method: 'PUT',
      path: `/api/admin/building/facilities/${encodeURIComponent(str(p.facility_id))}/rental`,
      body: { isAvailableForRental: !!p.is_available_for_rental },
    }),
  },
  create_rental_rate: {
    allowedRoles: ['building_admin'],
    required: ['facility_id', 'fee_category', 'rate_name', 'rate_type', 'amount'],
    validate: (p) => {
      const validCategories = ['rental', 'energy', 'personnel']
      if (!validCategories.includes(str(p.fee_category))) return `fee_category must be one of: ${validCategories.join(', ')}`
      const validTypes = ['hourly', 'flat', 'variable']
      if (!validTypes.includes(str(p.rate_type))) return `rate_type must be one of: ${validTypes.join(', ')}`
      if (p.time_period) {
        const validPeriods = ['am', 'pm', 'all_day']
        if (!validPeriods.includes(str(p.time_period))) return `time_period must be one of: ${validPeriods.join(', ')}`
      }
      const amt = Number(p.amount)
      if (!Number.isFinite(amt) || amt <= 0) return 'amount must be a positive number'
      return null
    },
    describe: (p) => `Create rental rate "${str(p.rate_name)}" (₱${str(p.amount)}) for ${str(p.facility_name) || str(p.facility_id)}`,
    request: (p) => ({
      method: 'POST',
      path: '/api/admin/building/rates',
      body: {
        facilityId: str(p.facility_id),
        feeCategory: str(p.fee_category),
        rateName: str(p.rate_name),
        rateType: str(p.rate_type),
        amount: Number(p.amount),
        ...(p.time_period ? { timePeriod: str(p.time_period) } : {}),
        ...(p.applicable_start_time ? { applicableStartTime: str(p.applicable_start_time) } : {}),
        ...(p.applicable_end_time ? { applicableEndTime: str(p.applicable_end_time) } : {}),
        ...(p.description ? { description: str(p.description) } : {}),
        ...(p.is_required !== undefined ? { isRequired: !!p.is_required } : {}),
        ...(p.is_addon !== undefined ? { isAddon: !!p.is_addon } : {}),
        ...(p.sort_order !== undefined ? { sortOrder: Number(p.sort_order) } : {}),
      },
    }),
  },
  update_rental_rate: {
    allowedRoles: ['building_admin'],
    required: ['rate_id'],
    describe: (p) => `Update rental rate ${str(p.rate_id)}`,
    request: (p) => {
      const body: Record<string, unknown> = {}
      if (p.rate_name) body.rateName = str(p.rate_name)
      if (p.amount !== undefined) body.amount = Number(p.amount)
      if (p.time_period) body.timePeriod = str(p.time_period)
      if (p.description !== undefined) body.description = str(p.description)
      if (p.is_active !== undefined) body.isActive = p.is_active
      return { method: 'PUT', path: `/api/admin/building/rates/${encodeURIComponent(str(p.rate_id))}`, body }
    },
  },
  delete_rental_rate: {
    allowedRoles: ['building_admin'],
    required: ['rate_id'],
    describe: (p) => `Delete rental rate ${str(p.rate_id)}`,
    request: (p) => ({
      method: 'DELETE',
      path: `/api/admin/building/rates/${encodeURIComponent(str(p.rate_id))}`,
    }),
  },

  // ─── IT Admin ────────────────────────────────────────────────────────────────
  assign_role: {
    allowedRoles: ['it_admin'],
    required: ['user_id', 'role_id'],
    describe: (p) => `Assign a role to ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/users/${encodeURIComponent(str(p.user_id))}/role`,
      body: { roleId: str(p.role_id) },
    }),
  },
  remove_role: {
    allowedRoles: ['it_admin'],
    required: ['user_id', 'role_id'],
    describe: (p) => `Remove a role from ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({
      method: 'DELETE',
      path: `/api/admin/users/${encodeURIComponent(str(p.user_id))}/role`,
      body: { roleId: str(p.role_id) },
    }),
  },
  restore_user: {
    allowedRoles: ['it_admin'],
    required: ['user_id'],
    describe: (p) => `Restore (un-archive) user ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/admin/users/${encodeURIComponent(str(p.user_id))}/restore` }),
  },
  lift_restriction: {
    allowedRoles: ['it_admin'],
    required: ['user_id'],
    risk: 'high',
    confirmPhrase: 'LIFT',
    describe: (p) => `Lift the restriction on ${str(p.user_name) || str(p.user_id)} (moves them to probation)`,
    request: (p) => ({ method: 'POST', path: `/api/admin/restricted-users/${encodeURIComponent(str(p.user_id))}/lift` }),
  },
  end_probation: {
    allowedRoles: ['it_admin'],
    required: ['user_id'],
    describe: (p) => `End probation for ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({ method: 'POST', path: `/api/admin/restricted-users/${encodeURIComponent(str(p.user_id))}/end-probation` }),
  },
  reset_user_password: {
    allowedRoles: ['it_admin'],
    required: ['user_id'],
    risk: 'high',
    confirmPhrase: 'RESET',
    describe: (p) => `Reset the password for ${str(p.user_name) || str(p.user_id)} (emails a new one)`,
    request: (p) => ({ method: 'POST', path: `/api/admin/users/${encodeURIComponent(str(p.user_id))}/reset-password` }),
  },
  issue_user_credit: {
    allowedRoles: ['it_admin'],
    required: ['user_id', 'amount_centavos', 'reason'],
    describe: (p) => `Issue ₱${(Number(p.amount_centavos) || 0) / 100} credit to ${str(p.user_name) || str(p.user_id)}`,
    request: (p) => ({
      method: 'POST',
      path: `/api/admin/users/${encodeURIComponent(str(p.user_id))}/issue-credit`,
      body: { amount_centavos: Number(p.amount_centavos) || 0, reason: str(p.reason) },
    }),
  },
  decide_assignment_request: {
    allowedRoles: ['it_admin'],
    required: ['request_id', 'status'],
    describe: (p) => `Set equipment assignment request ${str(p.request_id)} to "${str(p.status)}"`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/equipment-assignment-requests/${encodeURIComponent(str(p.request_id))}`,
      body: { status: str(p.status), ...(p.statusNote ? { statusNote: str(p.statusNote) } : {}) },
    }),
  },
  update_tech_report: {
    allowedRoles: ['it_admin'],
    required: ['report_id', 'status'],
    describe: (p) => `Set tech report ${str(p.report_id)} status to "${str(p.status)}"`,
    request: (p) => ({
      method: 'PATCH',
      path: `/api/equipment-reports/${encodeURIComponent(str(p.report_id))}`,
      body: { status: str(p.status) },
    }),
  },
}

/** True if `type` is a known action allowed for any of `roles`. */
export function isActionAllowed(type: string, roles: string[]): boolean {
  const def = (ACTIONS as Record<string, ActionDef>)[type]
  return !!def && def.allowedRoles.some((r) => roles.includes(r))
}

// ─── Four-rung tier ladder ──────────────────────────────────────────────────────
// auto → safe read (no confirm) · confirm → standard write (one-click) ·
// type → irreversible / wide blast-radius (user types a phrase) · navigate → opens
// a page. Reads are `auto`, navigation is `navigate`; every guarded write here is
// either `confirm` (risk normal) or `type` (risk high).
export type AssistantTier = 'auto' | 'confirm' | 'type' | 'navigate'

/** Records touched above this count auto-escalate a write to the `type` tier. */
const BLAST_RADIUS_LIMIT = 5

/** True if any param is a collection whose size exceeds the blast-radius limit. */
function hasWideBlastRadius(params: Record<string, unknown>): boolean {
  for (const [key, v] of Object.entries(params)) {
    if (Array.isArray(v) && v.length > BLAST_RADIUS_LIMIT) return true
    if (typeof v === 'number' && v > BLAST_RADIUS_LIMIT && /count|total|affected/i.test(key)) return true
  }
  return false
}

/**
 * Risk tier + (for high risk) the phrase the user must type to confirm.
 * A base-`normal` action auto-escalates to `high` when `params` describe a wide
 * blast radius (a bulk collection), so the UI forces type-to-confirm.
 */
export function getActionMeta(
  type: string,
  params?: Record<string, unknown>
): { risk: 'normal' | 'high'; confirmPhrase: string | null } {
  const def = (ACTIONS as Record<string, ActionDef>)[type]
  const escalated = !!params && hasWideBlastRadius(params)
  const risk: 'normal' | 'high' = def?.risk === 'high' || escalated ? 'high' : 'normal'
  return { risk, confirmPhrase: risk === 'high' ? def?.confirmPhrase ?? 'CONFIRM' : null }
}

/** The confirm-difficulty tier for a guarded write (`confirm` or `type`). */
export function getActionTier(type: string, params?: Record<string, unknown>): 'confirm' | 'type' {
  return getActionMeta(type, params).risk === 'high' ? 'type' : 'confirm'
}

// ─── Server-resolved facts for the confirm card (HIGH #1) ───────────────────────
export interface ActionFact {
  label: string
  value: string
}

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; cache?: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

/** Actions whose target is a booking → we re-fetch it for authoritative facts. */
const BOOKING_FACT_ACTIONS = new Set<string>([
  'cancel_my_booking', 'accept_alternative', 'approve_booking', 'reject_booking',
  'cancel_booking', 'approve_paid_booking', 'reject_paid_booking', 'cancel_building_booking',
])

/** Actions whose target is a payment → we re-fetch it for authoritative facts. */
const PAYMENT_FACT_ACTIONS = new Set<string>([
  'verify_qr_payment', 'reject_qr_payment', 'confirm_entitlement_refund', 'override_refund',
])

function extractFacilityName(b: Record<string, unknown>): string | null {
  const bf = b.booking_facilities as Array<{ facility?: { name?: string } }> | undefined
  return bf?.[0]?.facility?.name ?? null
}

async function fetchBookingFacts(
  id: string,
  ctx: { cookie: string | null; origin: string; fetchImpl?: FetchLike }
): Promise<ActionFact[] | null> {
  const fetchImpl = ctx.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  try {
    const url = new URL(`/api/bookings/${encodeURIComponent(id)}`, ctx.origin).toString()
    const res = await fetchImpl(url, { headers: ctx.cookie ? { cookie: ctx.cookie } : {}, cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { booking?: Record<string, unknown> } | null
    const b = json?.booking
    if (!b) return null
    const facts: ActionFact[] = []
    if (b.booking_reference) facts.push({ label: 'Reference', value: str(b.booking_reference) })
    const facility = extractFacilityName(b)
    if (facility) facts.push({ label: 'Facility', value: facility })
    if (b.booking_date) facts.push({ label: 'Date', value: str(b.booking_date) })
    if (b.start_time && b.end_time) facts.push({ label: 'Time', value: `${str(b.start_time)}–${str(b.end_time)}` })
    if (b.current_status) facts.push({ label: 'Status', value: str(b.current_status) })
    return facts.length ? facts : null
  } catch {
    return null
  }
}

async function fetchPaymentFacts(
  id: string,
  ctx: { cookie: string | null; origin: string; fetchImpl?: FetchLike }
): Promise<ActionFact[] | null> {
  const fetchImpl = ctx.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  try {
    const url = new URL(`/api/payments/${encodeURIComponent(id)}`, ctx.origin).toString()
    const res = await fetchImpl(url, { headers: ctx.cookie ? { cookie: ctx.cookie } : {}, cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { payment?: Record<string, unknown> } | null
    const p = json?.payment
    if (!p) return null
    const facts: ActionFact[] = []
    if (p.payment_reference) facts.push({ label: 'Payment', value: str(p.payment_reference) })
    if (p.booking && typeof p.booking === 'object' && 'booking_reference' in p.booking) {
      facts.push({ label: 'Booking', value: str((p.booking as Record<string, unknown>).booking_reference) })
    }
    if (p.amount != null) facts.push({ label: 'Amount', value: `₱${Number(p.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` })
    if (p.payment_status) facts.push({ label: 'Current Status', value: str(p.payment_status) })
    if (p.qr_payer_name) facts.push({ label: 'Payer', value: str(p.qr_payer_name) })
    if (p.qr_reference_number) facts.push({ label: 'Reference #', value: str(p.qr_reference_number) })
    return facts.length ? facts : null
  } catch {
    return null
  }
}

// Params surfaced as facts when we can't (or needn't) re-fetch an entity.
// Ordered so a human-readable name wins over its id (same label → first kept).
const PARAM_FACTS: Array<{ key: string; label: string }> = [
  { key: 'booking_reference', label: 'Reference' },
  { key: 'booking_id', label: 'Booking' },
  { key: 'user_name', label: 'User' },
  { key: 'user_id', label: 'User' },
  { key: 'term_name', label: 'Term' },
  { key: 'term_id', label: 'Term' },
  { key: 'status', label: 'New status' },
  { key: 'decision', label: 'Decision' },
  { key: 'role_id', label: 'Role' },
  { key: 'upload_id', label: 'Upload' },
  { key: 'request_id', label: 'Request' },
  { key: 'reason', label: 'Reason' },
]

function paramFacts(params: Record<string, unknown>): ActionFact[] | null {
  const facts: ActionFact[] = []
  const usedLabels = new Set<string>()
  for (const { key, label } of PARAM_FACTS) {
    if (usedLabels.has(label)) continue
    const v = params[key]
    if (v == null || (typeof v === 'string' && !v.trim())) continue
    facts.push({ label, value: str(v) })
    usedLabels.add(label)
  }
  return facts.length ? facts : null
}

function countDates(params: Record<string, unknown>): number {
  if (Array.isArray(params.dates) && params.dates.length > 0) return params.dates.length
  if (params.start_date && params.end_date) {
    const start = new Date(str(params.start_date))
    const end = new Date(str(params.end_date))
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    return days > 0 ? days : 1
  }
  return params.start_date ? 1 : 0
}

/**
 * create_school_event's confirm card must show the REAL facility/date counts resolved from
 * the request body, not whatever the model's prose claimed (e.g. a wrong "12 facilities" when
 * all_facilities: true actually means every active facility). all_facilities requires a live
 * count query; everything else is a plain array length, already resolved, no re-fetch needed.
 */
async function fetchSchoolEventCreateFacts(
  params: Record<string, unknown>,
  ctx: { cookie: string | null; origin: string; fetchImpl?: FetchLike }
): Promise<ActionFact[] | null> {
  const facts: ActionFact[] = []
  if (params.event_name) facts.push({ label: 'Event', value: str(params.event_name) })
  facts.push({ label: 'Mode', value: params.mode === 'exam_period' ? 'Exam Period' : 'School Event' })

  if (params.all_facilities === true) {
    const fetchImpl = ctx.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
    try {
      const url = new URL('/api/facilities?all=true', ctx.origin).toString()
      const res = await fetchImpl(url, { headers: ctx.cookie ? { cookie: ctx.cookie } : {}, cache: 'no-store' })
      const json = (await res.json()) as { facilities?: unknown[] } | null
      const count = Array.isArray(json?.facilities) ? json!.facilities!.length : null
      facts.push({ label: 'Facilities', value: count != null ? `All ${count} active facilities` : 'All active facilities' })
    } catch {
      facts.push({ label: 'Facilities', value: 'All active facilities' })
    }
  } else if (Array.isArray(params.facility_ids)) {
    facts.push({ label: 'Facilities', value: `${params.facility_ids.length}` })
  } else if (params.facility_id) {
    facts.push({ label: 'Facilities', value: '1' })
  }

  const dateCount = countDates(params)
  if (dateCount > 0) facts.push({ label: 'Days', value: `${dateCount}` })

  return facts.length ? facts : null
}

/**
 * Resolve the facts shown on the confirm card from the SERVER, not the model's
 * sentence. Booking-target actions re-fetch the booking (authoritative
 * reference/facility/date/status); create_school_event resolves real facility/date
 * counts; everything else surfaces the resolved params.
 * Falls back to params if a re-fetch fails. Returns null when nothing is known.
 */
export async function resolveActionFacts(
  type: string,
  params: Record<string, unknown>,
  ctx: { cookie: string | null; origin: string; fetchImpl?: FetchLike }
): Promise<ActionFact[] | null> {
  if (BOOKING_FACT_ACTIONS.has(type) && params.booking_id) {
    const booked = await fetchBookingFacts(str(params.booking_id), ctx)
    if (booked) return booked
  }
  if (PAYMENT_FACT_ACTIONS.has(type) && params.payment_id) {
    const paid = await fetchPaymentFacts(str(params.payment_id), ctx)
    if (paid) return paid
  }
  if (type === 'create_school_event') {
    const facts = await fetchSchoolEventCreateFacts(params, ctx)
    if (facts) return facts
  }
  return paramFacts(params)
}

/** Human summary for a proposed action (used when the model omits one). */
export function describeAction(type: string, params: Record<string, unknown>): string | null {
  const def = (ACTIONS as Record<string, ActionDef>)[type]
  return def ? def.describe(params) : null
}

/** Names of params still missing for a proposed action (empty = ready to confirm). */
export function missingActionParams(type: string, params: Record<string, unknown>): string[] {
  const def = (ACTIONS as Record<string, ActionDef>)[type]
  if (!def) return ['unknown_action']
  return def.required.filter((k) => {
    const v = params[k]
    return v == null || (typeof v === 'string' && !v.trim())
  })
}

/** Run optional param validation for an action. Returns error message or null. */
export function validateActionParams(type: string, params: Record<string, unknown>): string | null {
  const def = (ACTIONS as Record<string, ActionDef>)[type]
  if (!def?.validate) return null
  return def.validate(params)
}

/**
 * Execute a confirmed action by proxying to the existing endpoint with the
 * caller's cookie forwarded. Re-checks role + required params before dispatch.
 */
export async function executeAction(
  type: string,
  params: Record<string, unknown>,
  ctx: ActionContext
): Promise<ActionResult> {
  const def = (ACTIONS as Record<string, ActionDef>)[type]
  if (!def) return { ok: false, message: `Unknown action: ${type}`, status: 400 }

  if (!def.allowedRoles.some((r) => ctx.roles.includes(r))) {
    return { ok: false, message: 'You do not have permission to perform this action.', status: 403 }
  }

  const missing = missingActionParams(type, params)
  if (missing.length) {
    return { ok: false, message: `Missing required field(s): ${missing.join(', ')}`, status: 400 }
  }

  if (def.validate) {
    const validationError = def.validate(params)
    if (validationError) {
      return { ok: false, message: validationError, status: 400 }
    }
  }

  const spec = def.request(params)
  try {
    const url = new URL(spec.path, ctx.origin)
    const res = await fetch(url.toString(), {
      method: spec.method,
      headers: {
        'Content-Type': 'application/json',
        ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
      },
      body: spec.body ? JSON.stringify(spec.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    const text = await res.text()
    let json: Record<string, unknown> | null = null
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null
    } catch {
      json = null
    }

    if (!res.ok) {
      const msg = (json?.error as string) ?? `Action failed (${res.status})`
      return { ok: false, message: msg, status: res.status, data: json }
    }
    return { ok: true, message: (json?.message as string) ?? 'Done.', data: json }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Action failed', status: 500 }
  }
}
