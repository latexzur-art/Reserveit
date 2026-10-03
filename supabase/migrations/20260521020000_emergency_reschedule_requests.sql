-- ============================================================
-- Emergency Reschedule Requests (user-initiated)
-- ============================================================

-- 1. Extend emergency_request_status enum
ALTER TYPE public.emergency_request_status ADD VALUE IF NOT EXISTS 'pending_extra_payment';
ALTER TYPE public.emergency_request_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.emergency_request_status ADD VALUE IF NOT EXISTS 'declined';

-- 2. Allow 'reschedule_extra' as payment_type
--    Also narrow the one-active-payment-per-booking unique index so reschedule_extra
--    payments can coexist with the original completed booking payment.
DROP INDEX IF EXISTS public.payments_one_active_per_booking;
CREATE UNIQUE INDEX payments_one_active_per_booking
  ON public.payments (booking_id)
  WHERE payment_status IN ('pending', 'completed')
    AND payment_type IN ('booking', 'extension');


--    The column has an inline CHECK (auto-named payments_payment_type_check by Postgres).
--    Drop the inline check and the named extension_hours check, then re-add both.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_extension_hours;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN ('booking', 'extension', 'reschedule_extra'));

ALTER TABLE public.payments
  ADD CONSTRAINT payments_extension_hours CHECK (
    (payment_type = 'extension' AND extension_hours > 0) OR
    (payment_type IN ('booking', 'reschedule_extra') AND extension_hours IS NULL)
  );

-- 3. New table: emergency_reschedule_requests
CREATE TABLE IF NOT EXISTS public.emergency_reschedule_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- User-supplied fields
  reason                TEXT NOT NULL,
  attachment_url        TEXT,

  -- Proposed new schedule
  proposed_date         DATE NOT NULL,
  proposed_start_time   TIME NOT NULL,
  proposed_end_time     TIME NOT NULL,

  -- Snapshot of original schedule at time of submission
  original_date         DATE NOT NULL,
  original_start_time   TIME NOT NULL,
  original_end_time     TIME NOT NULL,

  -- Extra charge (0 when proposed duration <= original duration)
  extra_amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (extra_amount_centavos >= 0),

  -- Status lifecycle
  status public.emergency_request_status NOT NULL DEFAULT 'pending',

  -- Admin review
  reviewed_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  review_notes          TEXT,

  -- Extra payment link (set when admin approves with extra charge)
  extra_payment_id      UUID REFERENCES public.payments(id) ON DELETE SET NULL,

  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTE: Partial unique index using new enum value 'pending_extra_payment' is deferred
-- to 20260521020100_emergency_reschedule_partial_index.sql (same transaction restriction as bookings).

CREATE INDEX IF NOT EXISTS idx_reschedule_requests_status
  ON public.emergency_reschedule_requests(status);

CREATE INDEX IF NOT EXISTS idx_reschedule_requests_user
  ON public.emergency_reschedule_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_reschedule_requests_booking
  ON public.emergency_reschedule_requests(booking_id);

CREATE INDEX IF NOT EXISTS idx_reschedule_requests_extra_payment
  ON public.emergency_reschedule_requests(extra_payment_id)
  WHERE extra_payment_id IS NOT NULL;

-- RLS
ALTER TABLE public.emergency_reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reschedule requests"
  ON public.emergency_reschedule_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own reschedule requests"
  ON public.emergency_reschedule_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access reschedule requests"
  ON public.emergency_reschedule_requests FOR ALL
  TO service_role
  USING (true);

-- updated_at trigger (reuse existing update_updated_at_column function)
CREATE TRIGGER update_emergency_reschedule_requests_updated_at
  BEFORE UPDATE ON public.emergency_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Atomic RPC: applies new schedule to booking AND marks request completed
CREATE OR REPLACE FUNCTION public.apply_user_emergency_reschedule(
  p_booking_id  UUID,
  p_request_id  UUID,
  p_new_date    DATE,
  p_new_start   TIME,
  p_new_end     TIME
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM id FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  UPDATE public.bookings
  SET
    booking_date = p_new_date,
    start_time   = p_new_start,
    end_time     = p_new_end,
    updated_at   = NOW()
  WHERE id = p_booking_id;

  UPDATE public.emergency_reschedule_requests
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_request_id;

  RETURN FOUND;
END;
$$;

-- 5. Extend notifications source_type CHECK to include 'reschedule_request'
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_source_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_source_type_check CHECK (
    source_type IS NULL OR source_type IN (
      'booking',
      'booking_reminder',
      'schedule_upload',
      'schedule_entry',
      'schedule',
      'schedule_conflict',
      'schedule_change_request',
      'facility_block',
      'broadcast',
      'admin_message',
      'restriction',
      'payment',
      'system',
      'override',
      'message',
      'appeal',
      'change_request',
      'maintenance',
      'user',
      'score_reset',
      'score_reset_request',
      'course_upload',
      'emergency_request',
      'reschedule_request',
      'session_credit',
      'password_reset_request'
    )
  );

COMMENT ON TABLE public.emergency_reschedule_requests IS
  'User-initiated emergency reschedule requests for paid approved bookings. '
  'Admin-reviewed; may require extra PayMongo payment when proposed duration exceeds original.';
