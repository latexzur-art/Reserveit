ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS qr_code_id UUID,
  ADD COLUMN IF NOT EXISTS qr_reference_number TEXT,
  ADD COLUMN IF NOT EXISTS qr_payer_name TEXT,
  ADD COLUMN IF NOT EXISTS qr_payer_contact_number TEXT,
  ADD COLUMN IF NOT EXISTS qr_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS qr_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_review_notes TEXT;
