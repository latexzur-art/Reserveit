ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS qr_payer_account_name TEXT,
  ADD COLUMN IF NOT EXISTS qr_payer_account_number TEXT;
