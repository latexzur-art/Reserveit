-- =====================================================
-- Add max_safe_hours to facilities for predictive wear-and-tear analytics
-- =====================================================
-- Description: Cumulative operational hours each facility can endure before
-- proactive maintenance is recommended (e.g., projector lifespan in AV rooms).
-- Used by BuildingReportsService.getMaintenancePredictors().
-- Date: 2026-06-16
-- =====================================================

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS max_safe_hours INTEGER;

COMMENT ON COLUMN public.facilities.max_safe_hours IS
  'Cumulative operational hours threshold before maintenance recommended. NULL = not tracked.';
