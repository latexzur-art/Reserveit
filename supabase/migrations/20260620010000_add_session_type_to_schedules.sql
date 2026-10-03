-- Add session_type (lecture | lab) to the schedule pipeline.
--
-- The upload route already writes session_type into schedule_entries_staging
-- (app/api/schedules/upload/route.ts), but no migration ever created the
-- column. On any DB built from migrations (db reset, fresh staging/prod) the
-- staging INSERT 500s with:
--   column "session_type" of relation "schedule_entries_staging" does not exist
-- The Supabase client is untyped, so tsc never caught it.
--
-- This adds the column to staging (fixes the upload) and to class_schedules so
-- the value survives publish and can drive lecture/lab-aware booking conflicts.
-- Mirrors the bookings.session_type pattern (TEXT, nullable, CHECK lecture|lab).
-- Idempotent — safe to (re)apply on any environment.

ALTER TABLE public.schedule_entries_staging
  ADD COLUMN IF NOT EXISTS session_type TEXT;

ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS session_type TEXT;

COMMENT ON COLUMN public.schedule_entries_staging.session_type
  IS 'Class session type. One of: lecture, lab. Optional.';
COMMENT ON COLUMN public.class_schedules.session_type
  IS 'Class session type, copied from staging on publish. One of: lecture, lab. Optional.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.schedule_entries_staging'::regclass
      AND conname = 'schedule_entries_staging_session_type_check'
  ) THEN
    ALTER TABLE public.schedule_entries_staging
      ADD CONSTRAINT schedule_entries_staging_session_type_check
      CHECK (session_type = ANY (ARRAY['lecture'::text, 'lab'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.class_schedules'::regclass
      AND conname = 'class_schedules_session_type_check'
  ) THEN
    ALTER TABLE public.class_schedules
      ADD CONSTRAINT class_schedules_session_type_check
      CHECK (session_type = ANY (ARRAY['lecture'::text, 'lab'::text]));
  END IF;
END $$;
