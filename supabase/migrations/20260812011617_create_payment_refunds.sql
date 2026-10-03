DO $$ BEGIN
  CREATE TYPE refund_trigger_type AS ENUM ('cancellation_request_entitlement', 'ba_override');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE refund_method_type AS ENUM ('manual', 'paymongo_api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  trigger_type refund_trigger_type NOT NULL,
  cancellation_request_id UUID REFERENCES public.cancellation_requests(id) ON DELETE SET NULL,
  refund_method refund_method_type NOT NULL DEFAULT 'manual',
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  reference_number TEXT,
  screenshot_url TEXT,
  justification_note TEXT,
  destination_name TEXT NOT NULL,
  destination_contact_number TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX payment_refunds_one_per_payment_idx ON public.payment_refunds(payment_id);
CREATE INDEX payment_refunds_booking_id_idx ON public.payment_refunds(booking_id);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own payment refunds"
  ON public.payment_refunds FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_refunds.payment_id AND p.user_id = auth.uid()));

CREATE POLICY "Admins manage payment refunds"
  ON public.payment_refunds FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name IN ('building_admin', 'it_admin') AND ur.is_active = TRUE
  ));

CREATE POLICY "Service role manages payment refunds"
  ON public.payment_refunds FOR ALL
  USING (auth.role() = 'service_role');

-- Keep payments.payment_status in sync automatically: inserting a refund
-- row always means the money has actually been sent (both API callers in
-- Task 26 only insert after evidence is captured), so flip to 'refunded'.
CREATE OR REPLACE FUNCTION public.handle_payment_refund_inserted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.payments SET payment_status = 'refunded', updated_at = NOW() WHERE id = NEW.payment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_payment_refund_inserted ON public.payment_refunds;
CREATE TRIGGER trigger_payment_refund_inserted
  AFTER INSERT ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_refund_inserted();
