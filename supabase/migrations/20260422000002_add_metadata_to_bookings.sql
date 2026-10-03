-- Add metadata JSONB column to bookings for storing addon flags and other extra data
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
