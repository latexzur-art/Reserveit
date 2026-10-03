-- Fix: complete_payment RPC — extension child booking stays 'pending' forever
--
-- When a user pays for a time extension, the `complete_payment` RPC extends the
-- parent booking's end_time but never transitions the child extension booking
-- from 'pending' to 'approved'. The child booking becomes orphaned.
--
-- This migration updates the `IF v_payment_type = 'extension'` block to also
-- find and approve any child extension booking linked to the parent via
-- `extension_of_booking_id`, but only for bookings that:
--   1. Are extensions of the parent (`is_extension = true`)
--   2. Are in a pending state (`current_status IN ('pending', 'pending_user_response')`)
--   3. Have a booking_date >= CURRENT_DATE (don't retroactively approve expired bookings)
--
-- Everything else in the function body is byte-identical to the previous definition
-- (20260812090623_complete_payment_accept_pending_review.sql).

CREATE OR REPLACE FUNCTION public.complete_payment(
  p_payment_id UUID,
  p_paymongo_data JSONB DEFAULT NULL,
  p_amount_centavos BIGINT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking_id UUID;
  v_payment_type TEXT;
  v_extension_hours DECIMAL;
  v_current_status TEXT;
  v_total_amount DECIMAL(10, 2);
  v_expires_at TIMESTAMPTZ;
  v_cash BIGINT;
  v_credits BIGINT;
  v_required BIGINT;
BEGIN
  SELECT booking_id, payment_type, extension_hours, payment_status, total_amount, expires_at
  INTO v_booking_id, v_payment_type, v_extension_hours, v_current_status, v_total_amount, v_expires_at
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_booking_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_current_status = 'completed' THEN
    RETURN true;
  END IF;

  IF v_current_status NOT IN ('pending', 'failed', 'pending_review') THEN
    RETURN false;
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    INSERT INTO public.financial_audit (payment_id, booking_id, amount, action)
    VALUES (p_payment_id, v_booking_id, v_total_amount, 'PAYMENT_LINK_EXPIRED');
    RETURN false;
  END IF;

  IF p_amount_centavos IS NOT NULL THEN
    v_cash := p_amount_centavos;
    SELECT COALESCE(-SUM(amount_centavos), 0) INTO v_credits
    FROM public.session_credits
    WHERE applied_to_payment_id = p_payment_id
      AND event_type = 'applied';
    v_required := CEIL(v_total_amount * 100);

    IF v_cash + v_credits < v_required THEN
      INSERT INTO public.financial_audit (payment_id, booking_id, amount, action)
      VALUES (p_payment_id, v_booking_id, v_total_amount, 'PAYMENT_UNDERPAID');
      RETURN false;
    END IF;
  END IF;

  UPDATE public.payments
  SET payment_status = 'completed',
      paid_at = NOW(),
      paymongo_webhook_data = COALESCE(p_paymongo_data, paymongo_webhook_data),
      updated_at = NOW()
  WHERE id = p_payment_id;

  IF v_payment_type = 'booking' THEN
    UPDATE public.bookings
    SET requires_payment = false, updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  IF v_payment_type = 'extension' AND v_extension_hours IS NOT NULL THEN
    -- Extend the parent booking's end_time
    UPDATE public.bookings
    SET end_time = end_time + (v_extension_hours || ' hours')::INTERVAL, updated_at = NOW()
    WHERE id = v_booking_id;

    -- Update child extension booking status to approved
    UPDATE public.bookings
    SET current_status = 'approved', approved_at = NOW(), updated_at = NOW()
    WHERE extension_of_booking_id = v_booking_id
      AND is_extension = true
      AND current_status IN ('pending', 'pending_user_response')
      AND booking_date >= CURRENT_DATE;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
