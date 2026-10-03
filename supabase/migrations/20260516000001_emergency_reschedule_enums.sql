-- Emergency reschedule feature: new enum values, payment refund columns, atomic RPC

-- New booking statuses
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_user_response';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'on_hold';

-- New override action (differentiates from academic head reschedule)
ALTER TYPE override_action ADD VALUE IF NOT EXISTS 'emergency_reschedule';

-- New payment status for admin-processed refunds
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';

-- Refund tracking columns on payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Atomic time-swap RPC for accepted emergency reschedules
-- Uses a dedicated RPC (not apply_booking_proposal) to avoid facility-swap complications
-- when the facility does not change (same facility, new date/time only)
CREATE OR REPLACE FUNCTION public.apply_emergency_reschedule(
  p_booking_id UUID,
  p_new_date DATE,
  p_new_start TIME,
  p_new_end TIME
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM id FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  UPDATE public.bookings
  SET
    booking_date = p_new_date,
    start_time   = p_new_start,
    end_time     = p_new_end,
    updated_at   = NOW()
  WHERE id = p_booking_id;

  RETURN FOUND;
END;
$$;
