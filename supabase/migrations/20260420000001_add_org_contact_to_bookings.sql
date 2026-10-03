-- Add organization name and contact number for external client bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_number    TEXT;
