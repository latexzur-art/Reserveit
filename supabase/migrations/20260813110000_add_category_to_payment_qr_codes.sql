-- Add category column to payment_qr_codes for filtering by QR type
ALTER TABLE public.payment_qr_codes
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';
