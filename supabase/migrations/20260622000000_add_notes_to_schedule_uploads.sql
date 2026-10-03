-- Add notes column to schedule_uploads for easier identification
ALTER TABLE public.schedule_uploads
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.schedule_uploads.notes IS 'Optional notes/remarks provided by the user to identify the upload in history and logs';
