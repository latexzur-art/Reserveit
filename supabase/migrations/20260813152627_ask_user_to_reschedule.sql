-- BA can ask the user to pick their own reschedule date
-- Adds request_user_to_pick column to booking_overrides

ALTER TABLE public.booking_overrides
  ADD COLUMN IF NOT EXISTS request_user_to_pick BOOLEAN NOT NULL DEFAULT FALSE;
