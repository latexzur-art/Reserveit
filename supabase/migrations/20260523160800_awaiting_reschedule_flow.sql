-- =====================================================
-- Awaiting-Reschedule State for Displaced Bookings
-- =====================================================
-- When a special event is approved and blocks existing bookings, instead of
-- hard-cancelling them we move them to awaiting_reschedule and let the owner
-- pick a new slot. After the deadline passes, the booking is auto-cancelled.
-- =====================================================

-- Extend booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'awaiting_reschedule';

-- Add displacement tracking columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS block_event_id          UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reschedule_deadline      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_date            DATE,
  ADD COLUMN IF NOT EXISTS original_start_time      TIME,
  ADD COLUMN IF NOT EXISTS original_end_time        TIME,
  ADD COLUMN IF NOT EXISTS original_facility_id     UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

-- NOTE: Partial index using new enum 'awaiting_reschedule' deferred to
-- 20260523160900_awaiting_reschedule_partial_index.sql (same transaction restriction).

-- Table for class-schedule reschedule offers (one row per affected schedule per event)
CREATE TABLE IF NOT EXISTS public.class_schedule_reschedule_offers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_schedule_id   UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  block_event_id      UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  affected_date       DATE NOT NULL,
  instructor_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'rescheduled', 'expired', 'cancelled')),
  new_date            DATE,
  new_start_time      TIME,
  new_end_time        TIME,
  new_facility_id     UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  deadline            TIMESTAMPTZ NOT NULL,
  decided_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS csro_class_schedule_id_idx ON public.class_schedule_reschedule_offers(class_schedule_id);
CREATE INDEX IF NOT EXISTS csro_block_event_id_idx    ON public.class_schedule_reschedule_offers(block_event_id);
CREATE INDEX IF NOT EXISTS csro_pending_deadline_idx  ON public.class_schedule_reschedule_offers(deadline)
  WHERE status = 'pending';

-- RLS: instructors can see/update their own offers; service role manages all
ALTER TABLE public.class_schedule_reschedule_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages all class schedule reschedule offers"
  ON public.class_schedule_reschedule_offers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Instructors can view their own reschedule offers"
  ON public.class_schedule_reschedule_offers FOR SELECT
  USING (instructor_user_id = auth.uid());

-- Extend notifications source_type check to include new types
-- (This extends the existing check constraint if one exists; wraps in a DO block for safety)
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_source_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Re-add with new source types included
DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_type_check
    CHECK (source_type IN (
      'booking', 'booking_reminder', 'schedule_upload', 'schedule_entry', 'schedule',
      'schedule_conflict', 'schedule_change_request', 'facility_block', 'broadcast',
      'admin_message', 'restriction', 'payment', 'system', 'override', 'message',
      'appeal', 'change_request', 'maintenance', 'user', 'score_reset',
      'score_reset_request', 'course_upload', 'emergency_request', 'session_credit',
      'password_reset_request', 'reschedule_offer', 'special_event'
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
