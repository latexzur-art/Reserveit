-- Add extension tracking fields to bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS extension_of_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_extension BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bookings_extension_of ON public.bookings(extension_of_booking_id);

COMMENT ON COLUMN public.bookings.is_extension IS 'True when this booking is a time-extension request for another booking';
COMMENT ON COLUMN public.bookings.extension_of_booking_id IS 'References the parent booking this record is extending';
