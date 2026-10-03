-- Fix courses table constraints and schema
-- 1. Add 'practicum' to delivery_mode allowed values
-- 2. Make batch_upload_id nullable (manual course entries don't belong to a batch)
-- 3. Add missing description and created_by columns used by course.service.ts

-- 1. Update delivery_mode CHECK constraint to include 'practicum'
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_delivery_mode_check;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_delivery_mode_check
  CHECK (delivery_mode IN ('lecture', 'lab', 'both', 'practicum'));

-- 2. Make batch_upload_id nullable so manually created courses don't need a batch
ALTER TABLE public.courses
  ALTER COLUMN batch_upload_id DROP NOT NULL;

-- 3. Add description column if it doesn't exist
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 4. Add created_by column if it doesn't exist
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
