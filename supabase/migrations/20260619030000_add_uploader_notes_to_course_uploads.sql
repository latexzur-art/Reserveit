-- Add uploader_notes to course_uploads to track program head annotations
ALTER TABLE public.course_uploads ADD COLUMN IF NOT EXISTS uploader_notes TEXT;
