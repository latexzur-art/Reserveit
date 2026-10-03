/** Chatbot constants. */

import type { CollectedFields } from "./types";

export const EMPTY_FIELDS: CollectedFields = {
  facility_id: null, facility_name: null, booking_date: null,
  start_time: null, end_time: null, booking_purpose: null,
  expected_attendees: null, booking_department_code: null,
  booking_course_code: null, session_type: null, event_name: null,
  facility_purpose_category: null, purpose: null, special_requests: null,
};

export const PURPOSE_LABELS: Record<string, string> = {
  academic: "Academic / Class",
  school_event: "School Event",
  department_use: "Department Use",
  personal: "Personal",
  commercial: "Commercial",
  community: "Community",
};

export const RESERVE_NOW_PROMPT =
  "Reserve a room now — based on what you know, suggest the best available room, tell me its match rating, and check whether it would be auto-approved.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const TOOL_LABELS: Record<string, string> = {
  get_pending_reviews: "Bookings awaiting review",
  get_reliability: "Faculty reliability",
  get_my_credits: "My credits",
  get_my_payments: "My payments",
  get_my_reliability: "My reliability",
  get_schedule_reviews: "Schedule reviews",
  get_reports_summary: "Reports summary",
  get_maintenance: "Maintenance",
  get_roles: "Roles",
  get_reports: "Reports",
  get_facility_status: "Facility status",
  get_today_bookings: "Today's bookings",
  get_pending_paid_bookings: "Pending paid bookings",
  search_users: "Users",
  get_audit_logs: "Audit logs",
  get_notifications: "Notifications",
  get_my_schedule: "My schedule",
  view_person: "Person",
  get_courses: "Courses",
  get_curriculum_pending: "Curriculum — pending",
  get_schedule_uploads: "Schedule uploads",
  get_professor_assignments: "Professor assignments",
  get_approved_schedules: "Approved schedules",
  get_sections: "Sections",
  get_upload_history: "Upload history",
  get_school_events: "School events",
  get_departments: "Departments",
  get_change_requests: "Change requests",
  get_special_events: "Special events",
  get_rates: "Rental rates",
  get_equipment: "Equipment",
  get_hvac: "HVAC fixtures",
  get_issue_reports: "Issue reports",
  get_restricted_users: "Restricted users",
  get_faq: "FAQ",
  get_building_bookings: "Reservations",
  get_academic_terms: "Academic terms",
  get_tech_equipment: "Tech equipment",
  get_tech_reports: "Tech reports",
  get_assignment_requests: "Assignment requests",
  get_pamo_equipment: "Equipment inventory",
  get_pamo_attention: "Equipment needing attention",
  get_pamo_equipment_stats: "Inventory stats",
  get_pamo_reports: "Asset reports",
};

export const ROW_KEYS = [
  "full_name", "name", "facility_name", "title", "email",
  "booking_reference", "reference", "status", "current_status",
  "booking_date", "date", "start_time", "action", "created_at",
];

