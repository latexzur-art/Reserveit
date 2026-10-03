-- Credit-aware amount cross-check for complete_payment.
-- A payment may only complete when cash received + credits applied to THIS payment
-- cover total_amount. Underpayment is rejected and audited; payment stays pending.
-- Applied credits are stored as NEGATIVE amount_centavos rows (event_type='applied'
-- in session_credits, see supabase/migrations/20260521010000_create_session_credits.sql
-- line ~258), so they are negated to a positive figure here.

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
  v_cash BIGINT;
  v_credits BIGINT;
  v_required BIGINT;
BEGIN
  SELECT booking_id, payment_type, extension_hours, payment_status, total_amount
  INTO v_booking_id, v_payment_type, v_extension_hours, v_current_status, v_total_amount
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_booking_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_current_status = 'completed' THEN
    RETURN true;
  END IF;

  IF v_current_status NOT IN ('pending', 'failed') THEN
    RETURN false;
  END IF;

  -- Amount cross-check. NULL cash means "amount unknown" (legacy callers) and skips
  -- the check; all real callers pass a value (0 for credit-only checkout).
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
