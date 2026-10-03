ALTER TABLE public.payment_qr_submissions
  ADD COLUMN IF NOT EXISTS payer_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_account_number TEXT;
