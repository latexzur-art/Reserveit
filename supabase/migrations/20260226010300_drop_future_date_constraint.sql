-- Drop the bookings_future_date constraint because it prevents state 
-- updates for existing bookings after their date has passed.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_future_date;
