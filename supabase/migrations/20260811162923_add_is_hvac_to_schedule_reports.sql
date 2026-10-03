-- =====================================================
-- Add is_hvac flag to schedule issue reports
-- =====================================================
-- Description: Adds is_hvac boolean to identify HVAC-related equipment issues.
--   When equipment_type is 'aircon', is_hvac is set to true, allowing the
--   Building Admin's HVAC panel to surface these reports.
-- Date: 2026-08-11
-- =====================================================

ALTER TABLE public.schedule_issue_reports
  ADD COLUMN IF NOT EXISTS is_hvac BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.schedule_issue_reports.is_hvac
  IS 'Whether this is an HVAC-related issue (equipment_type = aircon). Surfaces in BA HVAC panel.';
