-- =====================================================
-- Session Credits + Emergency Cancellation Requests
-- =====================================================
-- Description:
--   1. session_credits     — event-log ledger for per-user session credits.
--                            Balance = SUM(amount_centavos) of non-expired rows.
--                            Signed amounts: positive = issuance, negative = consumption.
--   2. emergency_cancellation_requests
--                          — user-initiated requests to cancel a paid booking under
--                            "special circumstances". Reviewed by building admin;
--                            on approval, a session credit is issued in lieu of refund.
-- Both back the "Special Circumstances" pipeline replacing PayMongo refunds.
-- =====================================================

-- =====================================================
-- 1. Notification source_type CHECK constraint extension
-- =====================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_source_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_source_type_check CHECK (
    source_type IS NULL OR source_type IN (
      'booking',
      'schedule_upload',
      'schedule_entry',
      'facility_block',
      'broadcast',
      'admin_message',
      'restriction',
      'payment',
      'system',
      'override',
      'message',
      'schedule_conflict',
      'appeal',
      'change_request',
      'maintenance',
      'user',
      'score_reset',
      'score_reset_request',
      'course_upload',
      'session_credit',
      'emergency_request'
    )
  );

-- =====================================================
-- 2. Enums
-- =====================================================
DO $$ BEGIN
  CREATE TYPE credit_event_type AS ENUM ('issued', 'applied', 'expired', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE credit_source AS ENUM (
    'force_majeure',
    'alternative_declined',
    'admin_manual',
    'checkout_application'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE emergency_request_status AS ENUM ('pending', 'approved', 'denied', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 3. session_credits table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.session_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- Signed centavos. Positive = issuance ('issued'), negative = consumption ('applied'/'expired'/'voided').
  amount_centavos BIGINT NOT NULL CHECK (amount_centavos <> 0),

  event_type credit_event_type NOT NULL,
  source credit_source NOT NULL,

  -- Linkage
  source_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  applied_to_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  applied_to_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,

  reason TEXT,
  issued_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_credits_user_id
  ON public.session_credits(user_id);

CREATE INDEX IF NOT EXISTS idx_session_credits_source_booking
  ON public.session_credits(source_booking_id)
  WHERE source_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_credits_applied_payment
  ON public.session_credits(applied_to_payment_id)
  WHERE applied_to_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_credits_applied_booking
  ON public.session_credits(applied_to_booking_id)
  WHERE applied_to_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_credits_event_type
  ON public.session_credits(event_type);

CREATE INDEX IF NOT EXISTS idx_session_credits_expires_at
  ON public.session_credits(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.session_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own session credits"
  ON public.session_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access session credits"
  ON public.session_credits FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.session_credits IS
  'Event-log ledger for per-user session credits. Balance = SUM(amount_centavos) of non-expired rows.';

-- =====================================================
-- 4. emergency_cancellation_requests table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.emergency_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status emergency_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  issued_credit_id UUID REFERENCES public.session_credits(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active (pending) request per booking
CREATE UNIQUE INDEX IF NOT EXISTS uniq_emergency_requests_one_pending_per_booking
  ON public.emergency_cancellation_requests(booking_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_emergency_requests_status
  ON public.emergency_cancellation_requests(status);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_user
  ON public.emergency_cancellation_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_booking
  ON public.emergency_cancellation_requests(booking_id);

ALTER TABLE public.emergency_cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own emergency requests"
  ON public.emergency_cancellation_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own emergency requests"
  ON public.emergency_cancellation_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated reviewers can read emergency requests"
  ON public.emergency_cancellation_requests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access emergency requests"
  ON public.emergency_cancellation_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_emergency_cancellation_requests_updated_at
  BEFORE UPDATE ON public.emergency_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.emergency_cancellation_requests IS
  'User-initiated emergency cancellation requests for paid bookings. Admin-reviewed; approval issues a session credit.';

-- =====================================================
-- 5. RPCs
-- =====================================================

-- get_user_credit_balance: sum of non-expired ledger rows
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(amount_centavos), 0)::BIGINT
  FROM public.session_credits
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- issue_session_credit: positive entry; returns inserted row id
CREATE OR REPLACE FUNCTION public.issue_session_credit(
  p_user_id UUID,
  p_amount_centavos BIGINT,
  p_source credit_source,
  p_source_booking_id UUID,
  p_issued_by UUID,
  p_reason TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  IF p_amount_centavos <= 0 THEN
    RAISE EXCEPTION 'issue amount must be positive (got %)', p_amount_centavos;
  END IF;

  INSERT INTO public.session_credits (
    user_id, amount_centavos, event_type, source,
    source_booking_id, issued_by, reason, expires_at
  ) VALUES (
    p_user_id, p_amount_centavos, 'issued', p_source,
    p_source_booking_id, p_issued_by, p_reason, p_expires_at
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- apply_credit_to_payment: atomic deduction with advisory lock
CREATE OR REPLACE FUNCTION public.apply_credit_to_payment(
  p_user_id UUID,
  p_amount_centavos BIGINT,
  p_payment_id UUID,
  p_booking_id UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance BIGINT;
  v_row_id UUID;
BEGIN
  IF p_amount_centavos <= 0 THEN
    RAISE EXCEPTION 'apply amount must be positive (got %)', p_amount_centavos;
  END IF;

  -- Serialise concurrent checkouts for the same user
  PERFORM pg_advisory_xact_lock(hashtext('credits:' || p_user_id::text));

  SELECT COALESCE(SUM(amount_centavos), 0) INTO v_balance
  FROM public.session_credits
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());

  IF v_balance < p_amount_centavos THEN
    RAISE EXCEPTION 'Insufficient credit balance: have %, need %', v_balance, p_amount_centavos;
  END IF;

  INSERT INTO public.session_credits (
    user_id, amount_centavos, event_type, source,
    applied_to_payment_id, applied_to_booking_id, reason
  ) VALUES (
    p_user_id, -p_amount_centavos, 'applied', 'checkout_application',
    p_payment_id, p_booking_id, 'Credit applied at checkout'
  ) RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$$;

-- =====================================================
-- 6. Seed helpdesk_email setting alongside existing emergency_helpdesk_phone
-- =====================================================
INSERT INTO public.system_settings (key, value, category, description)
VALUES (
  'emergency_helpdesk_email',
  '"helpdesk@sti-lucena.edu.ph"',
  'emergency',
  'Helpdesk email shown to users on paid reservation cards and emergency-request flows'
)
ON CONFLICT (key) DO NOTHING;
