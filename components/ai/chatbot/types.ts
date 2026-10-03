/** Shared types for the booking chatbot. */

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

export type ResponseAction =
  | { kind: "navigate"; href: string; label: string; prefill?: Record<string, unknown> }
  | {
      kind: "mutate";
      action_type: string;
      params: Record<string, unknown>;
      summary: string;
      requires_confirm: true;
      missing: string[];
      risk?: "normal" | "high";
      confirm_phrase?: string | null;
      /** Server-resolved facts (id + name + status) shown on the confirm card. */
      facts?: { label: string; value: string }[] | null;
    };

export interface LookupData {
  tool: string;
  result: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Optional structured lookup result rendered under this message. */
  data?: LookupData | null;
  /** Optional navigate/guarded-action proposal rendered under this message. */
  action?: ResponseAction | null;
  /** Set once a proposed mutate action has been confirmed/resolved. */
  actionResolved?: boolean;
}

export interface AssistantCapabilities {
  label: string;
  canBook: boolean;
  defaultFormRoute: string | null;
  quickActions: { label: string; prompt: string }[];
  destinations: { id: string; label: string; href: string }[];
}

export interface HistorySession {
  id: string;
  summary: string | null;
  title: string | null;
  /** Full transcript, so resuming restores the actual conversation. */
  messages: ChatMessage[] | null;
  collected_fields: CollectedFields | null;
  booking_flow: "standard" | "paid";
  last_active_at: string;
}

export interface RoomOption {
  id: string;
  name: string;
  facility_type_name: string | null;
  capacity: number;
  floor_name: string | null;
  is_paid_facility?: boolean;
  specialized_tag?: string | null;
}

export interface PaidRateInfo {
  facilityId: string;
  facilityName: string;
  amRate: number;
  pmRate: number;
  cutoffHour: number;
}

export interface RoomRating {
  rating: number;
  stars: number;
  reasons: string[];
}

export type GradeStatus = "auto_approve" | "review" | "declined" | "hard_fail" | null;

export interface GradeInfo {
  realScore: number | null;
  willAutoApprove: boolean;
  gradeStatus: GradeStatus;
  hardFail: { code: string; message: string } | null;
  reasoning: string | null;
}

export interface ChatResponse {
  message: string;
  intent?: "booking" | "question" | "reserve_now" | "lookup" | "action";
  collected_fields: CollectedFields;
  booking_flow: "standard" | "paid";
  next_question: string | null;
  ready_to_confirm: boolean;
  estimated_score: number | null;
  score_reasoning: string | null;
  real_score?: number | null;
  will_auto_approve?: boolean;
  grade_status?: GradeStatus;
  hard_fail?: { code: string; message: string } | null;
  suggested_room?: RoomOption | null;
  room_rating?: RoomRating | null;
  available_rooms?: RoomOption[];
  paid_facility_rates?: PaidRateInfo[];
  // Role-aware additions:
  action?: ResponseAction | null;
  data?: LookupData | null;
  role?: { label: string; can_book: boolean };
}

export interface RecentBooking {
  reference: string | null;
  facility_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  booking_purpose: string | null;
  event_name: string | null;
  status: string;
}

export interface PreviousSession {
  id: string;
  messages: ChatMessage[];
  collected_fields: CollectedFields;
  booking_flow: "standard" | "paid";
  last_active_at: string;
}

