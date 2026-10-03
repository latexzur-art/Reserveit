# Reservation Approval & Workflow

A reference for every file involved in creating, evaluating, approving, and closing reservations.

---

## Status Transitions

```
User submits → pending
  ↓ pipeline runs
  ├─ score >= 80, no issues       → auto_approved  (48-hr admin oversight window)
  ├─ score 35–79                  → flagged        (Academic Head reviews)
  ├─ score < 35                   → auto_declined
  ├─ facility-purpose mismatch    → flagged        (forced Academic Head review)
  └─ user restricted              → pending        (routed to building admin queue)

flagged / pending  →  approved  (Academic Head or Building Admin)
flagged / pending  →  rejected  (Academic Head or Building Admin)
auto_approved      →  overridden / rejected  (Building Admin, within 48-hr window)
approved / pending →  cancelled  (user or admin)
approved           →  completed  (automatic via RPC after booking date passes)
```

---

## Backend Services (`backend/booking/`)

### `bookingPipeline.ts`
The main entry point. Called immediately after a booking row is inserted.

**Steps:**
1. Load booking and user records (two separate queries to avoid fragile joins)
2. Build a `BookingContext` object from the combined data
3. **STEP 0** — `checkUserRestriction`: if restricted → route to admin queue, stop
4. **STEP 1** — `checkHardConstraints`: if failed and not reroutable → `auto_declined`, stop; if reroutable → return suggestions to frontend, delete pending row
5. **STEP 2** — `calculateScore`: compute 0–100 score
6. **STEP 2.5** — `checkFacilityPurposeMismatch`: if mismatch → `flagged`, email Academic Head, stop
7. **STEP 3** — `makeDecision`: convert score to final status, write `booking_decisions` row
8. **Race condition guard**: after approval, re-check for concurrent approvals on the same slot; roll back to `auto_declined` if found

**Exports:** `processBooking(supabase, bookingId): Promise<PipelineResult>`

---

### `hardConstraintChecker.ts`
Fail-fast validation against rules loaded from the `approval_constraint_rules` table (`constraint_type = 'hard'`). Rules are ordered by priority; the first failure stops evaluation.

**Checks (by rule code):**

| Code | What it checks |
|---|---|
| `USER_RESTRICTED` | `account_status = 'restricted'` on the user |
| `CLASS_CONFLICT` | Active class schedule on that facility + day, respecting exceptions |
| `BOOKING_CONFLICT` | Overlapping approved/flagged/pending booking on the same facility+date |
| `EQUIPMENT_CONFLICT` | Same equipment already booked for the overlapping time |
| `BUFFER_VIOLATION` | Booking is too close to another (within facility's `buffer_time`) |
| `ADMIN_BLOCK` | `facility_blocks` row covers the time range |
| `OUTSIDE_HOURS` | Outside 07:00–21:00 operating hours |
| `CAPACITY_EXCEEDED` | `expected_attendees` > facility capacity |
| `UNDER_MAINTENANCE` | Facility `status = 'maintenance'` |
| `EXAM_PERIOD_BLOCK` | Booking date falls within active term's exam window |
| `ENROLLMENT_BLOCK` | Booking date falls within active term's enrollment window |
| `ADVANCE_LIMIT` | Date is in the past, or beyond `advance_booking_days` limit |
| `DURATION_VIOLATION` | Duration outside facility's min/max booking duration |
| `PURPOSE_MISMATCH` | Computer facility booked for `commercial`, or facility type restricts the purpose |
| `EVENT_IN_CLASSROOM` | `school_event`, `commercial`, or `community` booking in a classroom/lecture room |
| `RESTRICTED_FACILITY` | Auditorium booked for `commercial` or `community` purposes |

Returns `HardConstraintResult` with `passed`, `failed_code`, `is_reroutable`, and `all_results`.

**Exports:** `checkHardConstraints(supabase, booking): Promise<HardConstraintResult>`

---

### `softScoringEngine.ts`
Calculates a 0–100 score using soft constraint rules from `approval_constraint_rules` (`constraint_type = 'soft'`). The rules are data-driven — admins can adjust point values without a code deploy.

**Base score:** 80

**Scoring factors:**
- User type and role (faculty, program head, external)
- Booking history: cancellation rate, number of past bookings
- Booking purpose (`academic` gets a bonus, `commercial` gets a penalty)
- Facility tier (`standard`, `premium`, `specialized`)
- Timing: same-day, weekend, evening, exam period, enrollment period
- Duration (long bookings penalised)
- Equipment count
- **Course-facility affinity** (via `course_facility_affinity` table): if a course code is specified, checks if the course maps to the facility's specialization tag (e.g., BSIT course + `computer_use` tag → +points)
- **Department-facility affinity** (fallback when no course code): BSIT/BSCS get a bonus for computer labs
- Mismatch justification weight (+15 for specialized equipment, +10 for exam requirement, –5 for generic)
- Detailed purpose description (+5 if >= 20 characters)
- Known event type justification (+10)

Final score is clamped to [0, 100].

**Exports:** `calculateScore(supabase, booking): Promise<ScoringResult>`

---

### `autoDecisionRouter.ts`
Converts a `ScoringResult` into a `BookingStatus`, updates the booking record, inserts a `booking_decisions` row, and sends notifications.

**Decision logic (evaluated in order):**

| Condition | Decision |
|---|---|
| User is on probation | `flagged` |
| User has `academic_head` role | `auto_approved` |
| Duration > 4 hours (240 min) | `flagged` |
| `mismatchFlag = SESSION_LECTURE_IN_LAB_MISMATCH` | `flagged` |
| `score >= 80` | `auto_approved` |
| `score >= 35` | `flagged` |
| `score < 35` | `auto_declined` |

On `auto_approved`: resets the user's `consecutive_cancellations` to 0.
Sets `oversight_expires_at` = now + 48 hours on every decision.
Notifies the requester and all `building_admin` + `academic_head` users.

**Also exports notification helpers:**
- `sendNotification(supabase, payload)` — insert a notification for a single user
- `sendNotificationToRoles(supabase, roleNames, payload)` — fan out to all users with the given roles

---

### `facilityMismatchChecker.ts`
Detects when a faculty member books a specialized facility outside their primary department without proper justification. Academic Head users skip this check entirely.

**Logic flow:**
1. No `departmentId` (external user) → no mismatch
2. User's department = facility's `primary_department_id` → no mismatch
3. Booking has a `course_code` that matches facility's affinity tags → `COURSE_FACILITY_MATCH` (no mismatch)
4. `sessionType = 'lecture'` + facility has lab tags → `SESSION_LECTURE_IN_LAB_MISMATCH` (force review)
5. Facility has no specialized tags → no mismatch (general-purpose room)
6. Dept+tag is in `department_facility_exceptions` and purpose category is whitelisted → `CROSS_DEPT_EXCEPTION_MATCHED`
7. Otherwise → `UNRECOGNIZED_CROSS_DEPT_USE`

For `UNRECOGNIZED_CROSS_DEPT_USE`:
- High-priority academic justifications (specialized equipment, exam, collaboration) → `forceManualReview = false` (scoring can still auto-approve)
- Other justifications → `forceManualReview = true` (always goes to Academic Head)
- Score penalty: 10 points if justified, 25 points if not

**Exports:** `checkFacilityPurposeMismatch(supabase, params): Promise<MismatchCheckResult>`

---

### `restrictionChecker.ts`
Checks whether a user is `restricted` or `probation` before the pipeline runs.

- `restricted`: booking is routed to the building admin manual queue; pipeline stops
- `probation`: pipeline continues but `autoDecisionRouter` forces `flagged` regardless of score

**Exports:** `checkUserRestriction(supabase, userId): Promise<RestrictionCheckResult>`

---

### `cancellationHandler.ts`
Handles user and admin cancellations, tracks the consecutive cancellation counter, and auto-restricts users at the threshold (`RESTRICTION_THRESHOLD = 3`).

**`handleCancellation`:**
- Calls `update_booking_status` RPC (creates audit trail in `booking_status_history`)
- For `user_cancelled` type: increments `consecutive_cancellations`; if >= 3 and `account_status = 'active'` → restricts the user, logs to `restriction_logs`, notifies admins
- Cancellable statuses: `pending`, `approved`, `auto_approved`, `flagged`, `pending_faculty_response`

**`handleCompletion`:**
- Marks booking as `completed` (only from `approved` / `auto_approved`)
- Resets the user's `consecutive_cancellations` to 0

**`handleBulkCancellation`:**
- Loops over a list of booking IDs and cancels each; sends admin summary notification

---

### `overrideHandler.ts`
Lets building admins intervene on `auto_approved` or `flagged` bookings within the 48-hour oversight window.

**Actions:**
- `cancel` → sets status to `overridden` via RPC
- `reschedule` → updates `booking_date`, `start_time`, `end_time`
- `change_facility` → updates `booking_facilities` row

Every override is logged to `booking_overrides` with original and new values. The requester is notified after each action.

**Exports:** `handleOverride(supabase, input): Promise<OverrideResult>`

---

### `availabilityService.ts`
Checks what time slots are available for a facility on a given date. Used by the booking form before submission.

**`getFacilityAvailability`** — returns all predefined `time_slots` with availability status. Blocked ranges come from:
- Published `class_schedules` (respects `day_of_week`, effective date range)
- Approved staging entries from `schedule_entries_staging` (dean-approved, not yet published)
- Active `booking_facilities` rows with status `approved`, `auto_approved`, `flagged`, `pending`
- `facility_blocks` rows (maintenance, admin blocks)

Each slot has a `conflict_type`: `class`, `booking`, `maintenance`, `admin_block`, or `outside_hours`.
Buffer time from `facilities.buffer_time` is applied to all conflict checks.

**`checkTimeSlotAvailability`** — point check for a specific time range; used for inline validation.

---

### `booking.types.ts`
All shared types and constants for the pipeline.

**Key exports:**

```ts
type BookingStatus =
  | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed'
  | 'auto_approved' | 'auto_declined' | 'flagged' | 'overridden'
  | 'pending_faculty_response'

const SCORING_THRESHOLDS = { AUTO_APPROVE: 80, FLAG_MIN: 35, AUTO_DECLINE_BELOW: 35 }
const OVERSIGHT_WINDOW_HOURS = 48
const RESTRICTION_THRESHOLD = 3
const BASE_SCORE = 80
```

Other types: `BookingContext`, `BookingPurpose`, `HardConstraintResult`, `ScoringResult`, `PipelineResult`, `AlternativeSuggestion`, `OverrideInput`, `AvailabilityResponse`, `ConflictCheckResult`, `ScoringContext`

---

## API Routes

### `app/api/bookings/route.ts`

**GET** — List the authenticated user's bookings. Supports `status`, `dateFrom`, `page`, `pageSize` query params. Calls `auto_complete_past_bookings` RPC before returning results.

**POST** — Create a new booking.
1. Auth + rate limit check (`booking:<userId>`)
2. Validate body with `CreateBookingSchema` (Zod)
3. Auto-set `session_type` for single-delivery-mode courses
4. Insert row with `current_status = 'pending'`; link facility and equipment
5. Call `processBooking(supabase, bookingId)`
6. If reroutable hard constraint → fetch suggestions, delete the pending row, return suggestions
7. Otherwise return `PipelineResult` + `booking_reference`

---

### `app/api/bookings/[id]/route.ts`
**GET** — Single booking detail for the owning user.
**PATCH** — Update booking fields (used for minor amendments).

---

### `app/api/bookings/[id]/cancel/route.ts`
**POST** — User-initiated cancellation. Calls `handleCancellation` with type `user_cancelled`.

---

### `app/api/bookings/[id]/complete/route.ts`
**POST** — Manually mark a booking as completed. Calls `handleCompletion`.

---

### `app/api/bookings/[id]/mismatch-review/route.ts`
**POST** — Submit a mismatch review decision (used by Academic Head when a mismatch flag is present).

---

### `app/api/bookings/[id]/accept-alternative/route.ts`
**POST** — Requester accepts an alternative facility proposed by an admin.

---

### `app/api/bookings/appeal/route.ts`
**POST** — User submits an appeal on a declined or restricted booking.

---

### `app/api/bookings/suggestions/route.ts`
**GET** — Fetch alternative slot/facility suggestions after a reroutable hard constraint failure.

---

### `app/api/bookings/auth-guard.ts`
Shared helper used by all booking routes. Verifies the session and returns the authenticated user (with roles). Returns a 401 response if unauthenticated.

---

### `app/api/academic-head/reservations/route.ts`
**GET** — List all bookings across all departments for the Academic Head. Supports `status`, `department`, date range, search, and pagination filters. Also auto-completes past approved bookings.

---

### `app/api/academic-head/review-booking/route.ts`
**POST** — Academic Head approves or rejects a `pending` or `flagged` booking.
- Requires `academic_head` role
- Input: `{ booking_id, action: 'approve' | 'reject', reason }` (reason >= 10 chars)
- Calls `update_booking_status` RPC → sets status to `approved` or `rejected`
- Sends notification to requester

---

### `app/api/academic-head/propose-changes/route.ts`
**POST** — Academic Head proposes an alternative date/time/facility to the requester. Sets booking to `pending_faculty_response`.

---

### `app/api/academic-head/respond-proposal/route.ts`
**POST** — Requester accepts or declines a proposed change.

---

### `app/api/academic-head/mismatch-reviews/route.ts`
**GET** — List bookings flagged for mismatch review (`assigned_reviewer_role = 'academic_head'`).

---

### `app/api/academic-head/cancel-booking/route.ts`
**POST** — Academic Head cancels a booking. Calls `handleCancellation` with type `admin_cancelled`.

---

### `app/api/academic-head/bookings/[id]/route.ts`
**GET / PATCH** — Get or update a single booking (Academic Head scope).

---

### `app/api/academic-head/bookings/bulk-delete/route.ts`
**POST** — Bulk delete `completed`, `cancelled`, or `rejected` booking records.

---

### `app/api/admin/building/bookings/route.ts`
**GET** — All bookings with facility info and decision history. Supports status, date, and pagination filters.
**POST** — Manual booking creation by building admin (bypasses the pipeline, sets status directly).

---

### `app/api/admin/building/bookings/[id]/route.ts`
**GET** — Single booking with full audit trail (via `BuildingBookingsService.getById`).
**PATCH** — Approve, reject, or cancel a booking. Dispatches to:
- `BuildingBookingsService.approve(id, notes)` — approvable statuses: `pending`, `flagged`, `auto_approved`
- `BuildingBookingsService.reject(id, notes)` — same statuses
- `BuildingBookingsService.cancel(id, notes)` — cancellable statuses: `pending`, `approved`, `auto_approved`, `flagged`

Each action updates `booking_decisions`, writes to `booking_status_history`, and notifies the requester.

---

### `app/api/admin/building/bookings/manual/route.ts`
**POST** — Admin-only direct booking creation with immediate approval (no pipeline).

---

## Hooks

### `hooks/academic-head/useAcademicReservations.ts`
Client-side state for the Academic Head reservations list. Fetches from `/api/academic-head/reservations`. Exposes:
- `reviewBooking(id, action, reason)` → POST `/api/academic-head/review-booking`
- `proposeChanges(id, changes)` → POST `/api/academic-head/propose-changes`
- `cancelBooking(id, reason)` → POST `/api/academic-head/cancel-booking`

### `hooks/academic-head/useAcademicBooking.ts`
Form state for the Academic Head booking form. Handles facility selection, availability checking, mismatch detection, session type selection, and submission to `/api/bookings`.

### `hooks/academic-head/useMismatchReviews.ts`
Fetches and manages bookings pending facility-purpose mismatch review from `/api/academic-head/mismatch-reviews`.

### `hooks/admin/building/useBuildingBookings.ts`
Fetches and manages the building admin booking list from `/api/admin/building/bookings`. Exposes `updateBookingStatus(id, action, notes)` which calls the `[id]` PATCH route.

---

## Database Tables Referenced

| Table | Role |
|---|---|
| `bookings` | Master booking record; holds `current_status`, `decision_score`, `oversight_expires_at` |
| `booking_facilities` | Many-to-one link: booking → facility |
| `booking_equipment` | Many-to-many link: booking → equipment |
| `booking_decisions` | One decision record per booking; stores score breakdown and reason |
| `booking_status_history` | Full audit log of every status change (written by `update_booking_status` RPC) |
| `booking_overrides` | Log of admin overrides within the oversight window |
| `approval_constraint_rules` | Hard and soft constraint rules loaded dynamically by the pipeline |
| `facility_blocks` | Admin-created time blocks on facilities (maintenance, events, enrollment) |
| `restriction_logs` | Log of user restriction events |
| `department_facility_exceptions` | Whitelist: which departments may book which specialized facility types |
| `course_facility_affinity` | Maps course codes to facility specialization tags for scoring/mismatch |
| `facility_purpose_tags` | Tags on facilities (e.g., `computer_use`, `science_lab`) |
