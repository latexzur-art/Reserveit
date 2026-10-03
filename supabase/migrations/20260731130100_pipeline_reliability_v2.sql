-- =====================================================
-- Booking Pipeline Reliability v2
-- =====================================================
-- Supports plans/booking-pipeline-decision-time-audit.md Phase 1:
--   F6 — sweeper poison-pill cap (pipeline_attempts)
--   F7 — pending_faculty_response (mismatch alternative) SLA deadline
-- =====================================================

-- F6: track how many times the sweeper/after() has attempted to process a booking,
-- so a deterministically-throwing row doesn't retry forever every 5 minutes.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pipeline_attempts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bookings.pipeline_attempts IS
  'Number of times processBooking has been attempted for this row. Incremented on every throw caught by the F1/F11 claim-reset guard. The sweeper dead-letters (stops retrying) rows past a small threshold.';

-- F7: deadline for a faculty member to respond to a suggested alternative facility
-- (mismatch-review "suggest_alternative" action, current_status='pending_faculty_response').
-- Mirrors the existing reschedule_deadline pattern used for awaiting_reschedule.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS mismatch_alternative_deadline TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.mismatch_alternative_deadline IS
  'Deadline for the faculty member to accept/decline a suggested alternative facility (set when mismatch-review suggests one). Past this deadline with no response, the SLA cron auto-declines the booking (owner decision 2026-07-31).';

-- F3/L1: new notification source_type for the pending-approval SLA cron
-- (reminders + escalations for flagged / restriction-pending / pending_faculty_response).
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_source_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_type_check
    CHECK (source_type IN (
      'booking', 'booking_reminder', 'schedule_upload', 'schedule_entry', 'schedule',
      'schedule_conflict', 'schedule_change_request', 'facility_block', 'broadcast',
      'admin_message', 'restriction', 'payment', 'system', 'override', 'message',
      'appeal', 'change_request', 'maintenance', 'user', 'score_reset',
      'score_reset_request', 'course_upload', 'emergency_request', 'session_credit',
      'password_reset_request', 'reschedule_offer', 'special_event', 'pending_approval_sla'
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
