-- =====================================================
-- Add equipment_issue category to schedule issue reports
-- =====================================================
-- Description: Adds 'equipment_issue' to the allowed category values and
--   adds an equipment_type column for specifying what kind of equipment
--   (projector, TV, aircon, etc.) when the category is equipment_issue.
-- Date: 2026-08-11
-- =====================================================

-- Add equipment_issue to the category CHECK constraint
ALTER TABLE public.schedule_issue_reports
  DROP CONSTRAINT IF EXISTS schedule_issue_reports_category_check;

ALTER TABLE public.schedule_issue_reports
  ADD CONSTRAINT schedule_issue_reports_category_check CHECK (category IN (
    'wrong_room', 'time_conflict', 'missing_session',
    'incorrect_time', 'instructor_mismatch', 'not_updated',
    'equipment_issue', 'other'
  ));

-- Add equipment_type column for specifying the equipment when category is equipment_issue
ALTER TABLE public.schedule_issue_reports
  ADD COLUMN IF NOT EXISTS equipment_type TEXT;

COMMENT ON COLUMN public.schedule_issue_reports.equipment_type
  IS 'Type of equipment when category is equipment_issue (e.g., projector, TV, aircon, computer, microphone)';
