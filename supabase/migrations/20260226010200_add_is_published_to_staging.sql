-- Add is_published to schedule_entries_staging to track which entries made it to the live schedules
ALTER TABLE public.schedule_entries_staging
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.schedule_entries_staging.is_published IS
  'True if this staging entry was successfully published to class_schedules. Helps filter review queues.';
