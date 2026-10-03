-- Make complete_payment race-safe.
-- The webhook handler and the status-poll endpoint both call this RPC; without
-- a row lock, two near-simultaneous calls can both pass the `payment_status = 'pending'`
-- gate and double-apply side effects (booking.requires_payment toggle, end_time extension).

CREATE OR REPLACE FUNCTION public.complete_payment(
  p_payment_id UUID,
  p_paymongo_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking_id UUID;
  v_payment_type TEXT;
  v_extension_hours DECIMAL;
  v_current_status TEXT;
BEGIN
  -- Lock the payment row first; serializes concurrent webhook + poll callers.
  SELECT booking_id, payment_type, extension_hours, payment_status
  INTO v_booking_id, v_payment_type, v_extension_hours, v_current_status
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_booking_id IS NULL THEN
    RETURN false;
  END IF;

  -- Already completed: idempotent no-op.
  IF v_current_status = 'completed' THEN
    RETURN true;
  END IF;

  -- Only complete from pending or failed (failed allows retry).
  IF v_current_status NOT IN ('pending', 'failed') THEN
    RETURN false;
  END IF;

  UPDATE public.payments
  SET payment_status = 'completed',
      paid_at = NOW(),
      paymongo_webhook_data = COALESCE(p_paymongo_data, paymongo_webhook_data),
      updated_at = NOW()
  WHERE id = p_payment_id;

  IF v_payment_type = 'booking' THEN
    UPDATE public.bookings
    SET requires_payment = false,
        updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  IF v_payment_type = 'extension' AND v_extension_hours IS NOT NULL THEN
    UPDATE public.bookings
    SET end_time = end_time + (v_extension_hours || ' hours')::INTERVAL,
        updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
