CREATE TABLE IF NOT EXISTS public.payment_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_qr_codes_active_idx ON public.payment_qr_codes(is_active, display_order);

ALTER TABLE public.payment_qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read active qr codes"
  ON public.payment_qr_codes FOR SELECT
  USING (is_active = TRUE OR EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name IN ('building_admin', 'it_admin') AND ur.is_active = TRUE
  ));

CREATE POLICY "Admins manage qr codes"
  ON public.payment_qr_codes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name IN ('building_admin', 'it_admin') AND ur.is_active = TRUE
  ));

CREATE TRIGGER update_payment_qr_codes_updated_at
  BEFORE UPDATE ON public.payment_qr_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Now that payment_qr_codes exists, wire up the FK deferred from Task 11.
ALTER TABLE public.payments
  ADD CONSTRAINT payments_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES public.payment_qr_codes(id) ON DELETE SET NULL;
