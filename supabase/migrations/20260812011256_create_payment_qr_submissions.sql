CREATE TABLE IF NOT EXISTS public.payment_qr_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES public.payment_qr_codes(id) ON DELETE SET NULL,
  payer_name TEXT NOT NULL,
  payer_contact_number TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  screenshot_url TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_qr_submissions_payment_id_idx ON public.payment_qr_submissions(payment_id, submitted_at DESC);

ALTER TABLE public.payment_qr_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own qr submissions"
  ON public.payment_qr_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_qr_submissions.payment_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_qr_submissions.payment_id AND p.user_id = auth.uid()));

CREATE POLICY "Admins read all qr submissions"
  ON public.payment_qr_submissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name IN ('building_admin', 'it_admin') AND ur.is_active = TRUE
  ));

CREATE POLICY "Service role manages qr submissions"
  ON public.payment_qr_submissions FOR ALL
  USING (auth.role() = 'service_role');
