-- =====================================================
-- Allow Cascade Delete on Academic Terms
-- =====================================================
-- Description: Update foreign key constraints so that deleting
--              an academic term cascades to related records.
-- Date: 2026-02-25
-- =====================================================

-- 1. class_schedules.academic_term_id: RESTRICT → CASCADE
ALTER TABLE public.class_schedules
  DROP CONSTRAINT IF EXISTS class_schedules_academic_term_id_fkey;

ALTER TABLE public.class_schedules
  ADD CONSTRAINT class_schedules_academic_term_id_fkey
  FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id)
  ON DELETE CASCADE;

-- 2. schedule_uploads.academic_term_id: RESTRICT → CASCADE
ALTER TABLE public.schedule_uploads
  DROP CONSTRAINT IF EXISTS schedule_uploads_academic_term_id_fkey;

ALTER TABLE public.schedule_uploads
  ADD CONSTRAINT schedule_uploads_academic_term_id_fkey
  FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id)
  ON DELETE CASCADE;

-- 3. schedule_change_requests.academic_term_id (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schedule_change_requests'
      AND column_name = 'academic_term_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.schedule_change_requests DROP CONSTRAINT IF EXISTS schedule_change_requests_academic_term_id_fkey';
    EXECUTE 'ALTER TABLE public.schedule_change_requests ADD CONSTRAINT schedule_change_requests_academic_term_id_fkey FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id) ON DELETE CASCADE';
  END IF;
END $$;
