-- Targeted fix to public.complete_payment (last redefined in
-- 20260730020000_complete_payment_expiry_check.sql), found during review of the
-- payment-overhaul plan (Task 23a):
--
-- 1. QR payments (payment_method_mode introduced by the payment-overhaul plan) sit in
--    payment_status = 'pending_review' while awaiting Building Admin verification (set by
--    backend/payments/qrSubmissionService.ts). The status guard below only allowed
--    'pending'/'failed', so the upcoming qr-verify endpoint's call into this RPC would
--    always return false ("already processed") for every real QR verification. Add
--    'pending_review' to the allowed set.
-- 2. Pre-existing, unrelated gap: this function is SECURITY DEFINER but never set
--    search_path, which this repo's CLAUDE.md treats as a hard security requirement for
--    every SECURITY DEFINER function. Add SET search_path = public, pg_temp.
--
-- Everything else in the function body is byte-identical to the previous definition.

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
    UPDATE public.bookings
    SET end_time = end_time + (v_extension_hours || ' hours')::INTERVAL, updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
