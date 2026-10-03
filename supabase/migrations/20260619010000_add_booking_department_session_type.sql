-- Backfill migration: add booking_department_code + session_type to bookings.
--
-- These columns were applied DB-only to the production project and never
-- captured as a migration, so the dev project (which the local app targets)
-- was missing them. This caused:
--   GET /api/bookings -> 500
--   "column bookings.booking_department_code does not exist" (42703)
--
-- Schema mirrors production exactly:
--   booking_department_code TEXT  (nullable, no default)
--   session_type            TEXT  (nullable, CHECK in ('lecture','lab'))
-- Idempotent so it is safe to (re)apply on any environment.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_department_code TEXT;

COMMENT ON COLUMN public.bookings.booking_department_code
  IS 'Department code for course context (e.g., BSIT). Combined with booking_course_code to identify the exact course. Optional.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS session_type TEXT;

COMMENT ON COLUMN public.bookings.session_type
  IS 'Class session type for course-aware scoring. One of: lecture, lab. Optional.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_session_type_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_session_type_check
      CHECK (session_type = ANY (ARRAY['lecture'::text, 'lab'::text]));
  END IF;
END $$;
