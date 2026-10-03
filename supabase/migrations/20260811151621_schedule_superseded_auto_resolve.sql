-- =====================================================
-- Auto-resolve open schedule reports when schedule is superseded
-- =====================================================
-- Description: When a class_schedule is superseded (is_active set to false,
--   superseded_by set), auto-resolve any open schedule_issue_reports
--   referencing that schedule. This prevents stale reports from lingering
--   after a schedule update that likely fixed the reported issue.
-- Date: 2026-08-11
-- =====================================================

CREATE OR REPLACE FUNCTION public.resolve_reports_on_schedule_supersede()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a schedule is superseded (is_active becomes false AND superseded_by is set)
  IF NEW.is_active = false
     AND NEW.superseded_by IS NOT NULL
     AND (OLD.is_active = true OR OLD.superseded_by IS NULL) THEN

    UPDATE public.schedule_issue_reports
    SET
      status = 'resolved',
      resolution_notes = 'Schedule was updated/superseded. The reported issue may have been fixed.',
      resolved_at = NOW()
    WHERE schedule_id = NEW.id
      AND schedule_type = 'class'
      AND status IN ('pending', 'under_review');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_reports_on_schedule_supersede
  AFTER UPDATE ON public.class_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_reports_on_schedule_supersede();

COMMENT ON FUNCTION public.resolve_reports_on_schedule_supersede()
  IS 'Auto-resolves open schedule_issue_reports when a class_schedule is superseded';
