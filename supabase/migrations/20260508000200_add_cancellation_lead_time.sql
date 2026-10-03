-- =====================================================
-- P1-1: Capture cancellation lead time
-- =====================================================
-- Currently `consecutive_cancellations` counts every user_cancelled equally:
-- a cancellation made 7 days in advance is treated identically to one made
-- 30 minutes before the booking starts. Same-day cancellations are far more
-- disruptive (held capacity, blocked alternatives) and frequent same-day
-- cancellers are operationally important for admins to see.
--
-- Per audit decision: NO automatic penalty. Just record lead-time and surface
-- to admins. The academic head decides whether to act.
-- =====================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_lead_time_hours NUMERIC(10, 2);

COMMENT ON COLUMN public.bookings.cancellation_lead_time_hours IS
  'Hours between cancellation timestamp (Manila TZ) and the booking start '
  'datetime. NULL for non-cancelled bookings. Negative if cancelled after the '
  'booking would have started. <12 = same-day; <0 = retroactive.';

CREATE INDEX IF NOT EXISTS idx_bookings_same_day_cancellations
  ON public.bookings(user_id, cancelled_at DESC)
  WHERE cancellation_lead_time_hours IS NOT NULL
    AND cancellation_lead_time_hours < 12;
