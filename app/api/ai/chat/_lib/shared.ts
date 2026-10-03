/** Shared types + constants for the AI chat route. */

import { OpenAI } from "openai";
import type { AssistantActionType } from "@/backend/ai/roleCapabilities";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CollectedFields {
  facility_id: string | null;
  facility_name: string | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  booking_purpose: string | null;
  expected_attendees: number | null;
  booking_department_code: string | null;
  booking_course_code: string | null;
  session_type: string | null;
  event_name: string | null;
  facility_purpose_category: string | null;
  purpose: string | null;
  special_requests: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  collected_fields: CollectedFields;
  booking_flow?: "standard" | "paid";
}

export interface FacilityRecord {
  id: string;
  name: string;
  facility_type_name: string | null;
  capacity: number;
  floor_name: string | null;
  is_available: boolean;
  is_paid_facility: boolean;
  paid_booking_route: string | null;
  specialized_tag: string | null;
}

export interface PaidFacilityRateInfo {
  facilityId: string;
  facilityName: string;
  amRate: number;
  pmRate: number;
  cutoffHour: number;
}

export type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

// ─── Valid Values ─────────────────────────────────────────────────────────────
export const VALID_BOOKING_PURPOSES = [
  "academic", "school_event", "department_use", "personal", "commercial", "community",
];
export const VALID_SESSION_TYPES = ["lecture", "lab"];
export const VALID_EVENT_NAMES = [
  "makeup_class", "lab_activity", "faculty_meeting", "student_consultation",
  "thesis_defense", "review_session", "research_activity", "org_event",
  "seminar_workshop", "other",
];

export const EMPTY_FIELDS: CollectedFields = {
  facility_id: null, facility_name: null, booking_date: null,
  start_time: null, end_time: null, booking_purpose: null,
  expected_attendees: null, booking_department_code: null,
  booking_course_code: null, session_type: null, event_name: null,
  facility_purpose_category: null, purpose: null, special_requests: null,
};

export const MAX_TOOL_ROUNDS = 5;

// Param hints shown to the model for each guarded action it may propose.
export const ACTION_HINTS: Record<AssistantActionType, string> = {
  // Self-service
  cancel_my_booking: "cancel one of the user's OWN bookings (params: booking_id, booking_reference?, reason?)",
  accept_alternative: "accept the proposed alternative slot for the user's booking (params: booking_id, booking_reference?)",
  submit_appeal: "submit an appeal to lift the user's account restriction (params: appeal_reason — min 10 chars)",
  request_reliability_reset: "request a reliability-score reset for the user (params: reason — required)",
  emergency_cancel_my_booking: "emergency-cancel one of the user's OWN in-progress bookings (params: booking_id, reason — min 10 chars)",
  report_equipment_issue: "report an equipment issue (params: category, description, equipment_id?, facility_id?)",
  submit_facility_review: "submit a facility review (params: facility_id, rating 1-5, comment?)",
  // Program Head — curriculum batches (get batch_id from get_curriculum_pending)
  submit_curriculum_batch: "submit a curriculum batch for approval (params: batch_id, batch_name?)",
  publish_curriculum_batch: "publish a curriculum batch — makes its courses live (params: batch_id, batch_name?)",
  request_delete_curriculum_batch: "request deletion of a curriculum batch (params: batch_id, batch_name?, reason — required)",
  // Program Head — schedule uploads & school events
  submit_schedule_upload: "submit a class-schedule upload for academic head review (params: upload_id — from get_schedule_uploads)",
  create_school_event_ph: "create a school event request for academic head approval (params: event_name, facility_ids — array of facility UUIDs, booking_date, start_time?, end_time?)",
  cancel_school_event_ph: "cancel your pending school event request (params: event_id, event_name?)",
  submit_schedule_change_request: "submit a schedule change request to modify, cancel, or add a class schedule entry (params: change_type: modify|cancel|add, reason, original_schedule_id? (for modify/cancel), new_course_code?, new_course_name?, new_section?, new_instructor_name?, new_day_of_week?, new_start_time?, new_end_time?, new_facility_id?)",
  // Academic Head
  approve_booking: "approve a booking under review (params: booking_id, booking_reference?, reason — min 10 chars)",
  reject_booking: "reject a booking under review (params: booking_id, reason — min 10 chars, reason_code?)",
  cancel_booking: "cancel a user's booking as Academic Head (params: booking_id, reason — min 20 chars)",
  decide_reliability_request: "approve/decline a reliability-reset request (params: request_id, decision: approve|decline, notes?)",
  reset_reliability: "reset a user's reliability score (params: user_id, user_name?, notes?)",
  publish_schedule_upload: "publish a class-schedule upload to the live calendar — AUTO-CANCELS overlapping bookings (params: upload_id)",
  approve_curriculum_batch: "approve a curriculum batch in the approval queue (params: batch_id, batch_name?)",
  reject_curriculum_batch: "reject a curriculum batch (params: batch_id, batch_name?, reason — required)",
  send_back_curriculum_batch: "send a curriculum batch back for revision (params: batch_id, batch_name?, notes — required)",
  decide_change_request: "approve/reject a schedule change-request (params: request_id, decision: approve|reject, notes — required if rejecting, min 5 chars)",
  batch_approve_reviews: "batch-approve multiple booking reviews at once (params: booking_ids — array of booking ids from get_pending_reviews, reviewer_notes?)",
  // Academic Head — schedule & assignment management
  approve_schedule_upload: "approve a schedule upload to the live calendar (params: upload_id — from get_schedule_reviews)",
  reject_schedule_upload: "reject/rollback a schedule upload (params: upload_id)",
  create_school_event: "propose a School Event or Exam Period block — Building Admin submissions take effect immediately (voiding conflicting bookings), Academic Head submissions are sent to Building Admin for approval first (params: event_name, mode: school_event|exam_period, dates — array of YYYY-MM-DD, or legacy start_date/end_date, and either facility_ids — array, all_facilities: true, or legacy facility_id, start_time?, end_time?)",
  cancel_school_event: "cancel a school event/exam block — Building Admin's cancellation is immediate, Academic Head's is sent to Building Admin to confirm (params: group_id for a grouped block, or legacy event_id for a Program-Head-submitted one)",
  approve_school_event_request: "approve a pending Academic-Head-submitted school event request (Building Admin only) (params: group_id, event_name?)",
  reject_school_event_request: "reject a pending Academic-Head-submitted school event request (Building Admin only) (params: group_id, reason — required, event_name?)",
  confirm_school_event_cancellation: "confirm an Academic Head's cancellation request for an active block (Building Admin only) (params: group_id, event_name?)",
  decline_school_event_cancellation: "decline an Academic Head's cancellation request, keeping the block active (Building Admin only) (params: group_id, event_name?)",
  withdraw_school_event_request: "withdraw your own still-pending school event request before it's been decided (params: group_id, event_name?)",
  create_academic_term: "create a new academic term (params: term_name, term_code, academic_year, term_type: first_semester|second_semester|summer|midyear, start_date, end_date)",
  delete_booking: "permanently delete a booking (params: booking_id, booking_reference?)",
  assign_professor: "assign a professor to a class schedule (params: schedule_id, new_instructor_id, new_instructor_name — from get_faculty_availability)",
  unassign_professor: "unassign a professor from a class schedule (params: schedule_id)",
  approve_assignment_lineup: "approve a professor assignment lineup from a program head (params: lineup_id — from get_assignment_lineups)",
  reject_assignment_lineup: "reject a professor assignment lineup (params: lineup_id, notes — min 5 chars)",
  edit_schedule: "edit a class schedule — change room, time, or instructor (params: schedule_id, instructor_name?, facility_id?, day_of_week?, start_time?, end_time?, reason?)",
  create_schedule: "create a new class schedule entry (params: course_code, course_name, section, day_of_week, start_time, end_time, facility_id, instructor_id?, instructor_name?, department_id?)",
  deactivate_schedule: "deactivate a class schedule (params: schedule_id)",
  // Building Admin
  approve_paid_booking: "approve a pending paid/rental booking (params: booking_id, booking_reference?, notes?)",
  verify_qr_payment: "verify a renter's submitted QR payment proof, completing the booking (params: payment_id, payment_reference?, reference_number? — from get_refund_ledger or the needs-review data)",
  reject_qr_payment: "reject a renter's QR payment proof and prompt them to resubmit (params: payment_id, payment_reference?, reason — required)",
  confirm_entitlement_refund: "confirm that an Academic-Head-approved refund entitlement has actually been sent (params: payment_id, cancellation_request_id, reference_number?, destination_name?, destination_contact_number?)",
  override_refund: "issue a discretionary refund for any amount, bypassing Academic Head review — for arrangements made outside the app (params: payment_id, amount, justification_note, destination_name, destination_contact_number, reference_number?)",
  set_payment_mode: "switch the institution's active payment collection method for ALL future bookings (params: mode — one of paymongo, qr_after_approval, qr_at_submission)",
  reject_paid_booking: "reject a pending paid/rental booking (params: booking_id, booking_reference?, notes?)",
  cancel_building_booking: "cancel any booking as Building Admin (params: booking_id, booking_reference?, notes?)",
  dismiss_issue_report: "dismiss an equipment issue report (params: report_id — from get_issue_reports)",
  convert_issue_report: "convert an issue report into a maintenance ticket (params: report_id)",
  lift_building_restriction: "lift a user's restriction → probation (params: user_id, user_name?)",
  end_building_probation: "end a user's probation (params: user_id, user_name?)",
  clear_violations: "clear all violations for a user (params: user_id, user_name?)",
  restrict_user: "restrict a user — blocks all their bookings (params: user_id, user_name?, reason — required, min 10 chars)",
  place_on_probation: "place a user on probation — their bookings require manual approval (params: user_id, user_name?, reason — required, min 10 chars)",
  // Building Admin — FAQ, maintenance, emergency, equipment
  create_faq: "create a FAQ entry (params: question, answer, category?, role_tags?)",
  edit_faq: "edit an existing FAQ entry (params: faq_id — from get_faq, question?, answer?, category?, is_active?)",
  delete_faq: "delete a FAQ entry (params: faq_id — from get_faq)",
  create_maintenance: "schedule a maintenance record (params: type: facility|equipment, target_id, target_name, schedule_date, technician?, notes?)",
  approve_emergency_reschedule: "approve an emergency reschedule request (params: request_id — from get_emergency_requests)",
  decline_emergency_reschedule: "decline an emergency reschedule request (params: request_id, notes?)",
  approve_assignment_request: "approve/deny an equipment assignment request (params: request_id — from get_equipment_requests, status: approved|denied, statusNote?)",
  // Building Admin — rental facility management
  toggle_facility_rental: "enable or disable rental availability for a facility (params: facility_id — from get_facility_status, is_available_for_rental: boolean, facility_name?)",
  create_rental_rate: "create a rental rate for a facility (params: facility_id, fee_category: rental|energy|personnel, rate_name, rate_type: hourly|flat|variable, amount — number, time_period?: am|pm, applicable_start_time?, applicable_end_time?, description?, is_required?, is_addon?, sort_order?, facility_name?)",
  update_rental_rate: "update an existing rental rate (params: rate_id — from get_rates, rate_name?, amount?, time_period?, description?, is_active?)",
  delete_rental_rate: "delete (soft-deactivate) a rental rate (params: rate_id — from get_rates)",
  // IT Admin
  set_user_status: "change a user account status (params: user_id, user_name?, status: active|suspended|inactive|restricted)",
  set_active_term: "set the active academic term (params: term_id, term_name?)",
  assign_role: "assign a role to a user (params: user_id, user_name?, role_id — look up via get_roles)",
  remove_role: "remove a role from a user (params: user_id, user_name?, role_id — look up via get_roles)",
  restore_user: "restore an archived/deleted user (params: user_id, user_name?)",
  lift_restriction: "lift a user's restriction, moving them to probation (params: user_id, user_name?)",
  end_probation: "end a user's probation (params: user_id, user_name?)",
  reset_user_password: "reset a user's password and email them a new one (params: user_id, user_name?)",
  issue_user_credit: "issue account credit to a user (params: user_id, user_name?, amount_centavos — integer >0, reason — min 5 chars)",
  decide_assignment_request: "approve/deny an equipment assignment request (params: request_id — from get_assignment_requests, status: approved|denied, statusNote?)",
  update_tech_report: "update a tech-equipment report's status (params: report_id, status: open|under_process|resolved|still_broken|escalated)",
  file_schedule_report: "report a schedule issue (params: category: broken_equipment|missing_equipment|malfunction|wrong_equipment|equipment_unavailable|other, what_happened, schedule_type, schedule_id, facility_id?, what_to_correct?, equipment_type?, is_tech?)",
  update_schedule_report: "triage a schedule issue report (params: report_id, status [pending/under_review/resolved/dismissed/escalated], resolution_notes?)",
  escalate_schedule_report: "escalate a schedule report to equipment pipeline (params: report_id, facility_id, category [broken/missing/malfunction/other], description, equipment_id?, is_tech? — true routes to IT Admin, false routes to PAMO)",
  update_my_schedule_report: "update your own schedule report (params: report_id, what_to_correct? — add correction details)",
  notify_faculty: "notify faculty in a facility (params: facility_id, message)",
};

