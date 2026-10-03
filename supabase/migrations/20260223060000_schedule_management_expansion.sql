-- =====================================================
-- Schedule Management Module — Schema Expansion
-- =====================================================
-- Description:
--   1. Add batch_effective_date columns to schedule_uploads
--   2. Add uses_custom_dates to schedule_entries_staging
--   3. Add dean_review columns to schedule_entries_staging
--   4. Add cancelled_by_schedule_id to bookings
--   5. Create instructor_match_candidates table
--   6. Create schedule_publish_log table
-- Date: 2026-02-23
-- =====================================================

-- =====================================================
-- 1. schedule_uploads: batch effective dates
-- =====================================================
ALTER TABLE public.schedule_uploads
  ADD COLUMN IF NOT EXISTS batch_effective_date DATE,
  ADD COLUMN IF NOT EXISTS batch_effective_end_date DATE;

COMMENT ON COLUMN public.schedule_uploads.batch_effective_date IS
  'Default effective start date for all entries in this upload batch. Individual entries can override.';
COMMENT ON COLUMN public.schedule_uploads.batch_effective_end_date IS
  'Default effective end date for all entries. Typically the academic term end date.';

-- =====================================================
-- 2. schedule_entries_staging: custom date override flag
-- =====================================================
ALTER TABLE public.schedule_entries_staging
  ADD COLUMN IF NOT EXISTS uses_custom_dates BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.schedule_entries_staging.uses_custom_dates IS
  'True if this entry overrides the batch_effective_date with its own effective_start/end dates.';

-- =====================================================
-- 3. schedule_entries_staging: dean / academic head review
-- =====================================================
DO $$ BEGIN
  CREATE TYPE dean_review_status AS ENUM (
    'pending_review', 'dean_approved', 'dean_flagged', 'dean_rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.schedule_entries_staging
  ADD COLUMN IF NOT EXISTS dean_review_status dean_review_status DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS dean_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS dean_reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dean_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS staging_dean_review_idx
  ON public.schedule_entries_staging(dean_review_status);

-- =====================================================
-- 4. bookings: link auto-cancelled bookings to schedule
-- =====================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by_schedule_id UUID REFERENCES public.class_schedules(id);

COMMENT ON COLUMN public.bookings.cancelled_by_schedule_id IS
  'If this booking was auto-cancelled due to a class schedule taking priority, references the displacing schedule.';

-- =====================================================
-- 5. instructor_match_candidates table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.instructor_match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_entry_id UUID NOT NULL REFERENCES public.schedule_entries_staging(id) ON DELETE CASCADE,
  instructor_name_raw VARCHAR NOT NULL,
  matched_user_id UUID REFERENCES public.users(id),
  match_confidence NUMERIC(3,2) CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_method VARCHAR DEFAULT 'fuzzy',   -- 'exact', 'fuzzy', 'manual'
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_by UUID REFERENCES public.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.instructor_match_candidates IS
  'Fuzzy-match results for instructor names from schedule uploads. Allows manual confirmation.';

CREATE INDEX IF NOT EXISTS idx_instructor_match_staging
  ON public.instructor_match_candidates(staging_entry_id);
CREATE INDEX IF NOT EXISTS idx_instructor_match_user
  ON public.instructor_match_candidates(matched_user_id);

ALTER TABLE public.instructor_match_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages instructor matches"
  ON public.instructor_match_candidates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view instructor matches"
  ON public.instructor_match_candidates FOR SELECT
  USING (true);

-- =====================================================
-- 6. schedule_publish_log table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.schedule_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_upload_id UUID NOT NULL REFERENCES public.schedule_uploads(id),
  published_by UUID NOT NULL REFERENCES public.users(id),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  effective_date DATE NOT NULL,
  entries_published INTEGER DEFAULT 0,
  reservations_cancelled INTEGER DEFAULT 0,
  cancelled_booking_ids UUID[] DEFAULT '{}',
  notes TEXT
);

COMMENT ON TABLE public.schedule_publish_log IS
  'Audit trail for when schedule batches are committed to class_schedules and their reservation impact.';

ALTER TABLE public.schedule_publish_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages publish log"
  ON public.schedule_publish_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view publish log"
  ON public.schedule_publish_log FOR SELECT
  USING (true);
