-- =====================================================
-- Notify Building Admin when escalated equipment report is resolved
-- =====================================================
-- Description: When an equipment_issue_reports status changes to 'resolved',
--   notifies the Building Admin that the escalated schedule report can be
--   reviewed and closed. Creates a notification per BA user.
-- Date: 2026-08-11
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_ba_on_equipment_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_schedule_report_id UUID;
  ba_user_ids UUID[];
BEGIN
  -- Only act when status changes to 'resolved'
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN

    -- Find linked schedule report
    SELECT id INTO linked_schedule_report_id
    FROM public.schedule_issue_reports
    WHERE escalated_equipment_report_id = NEW.id
    LIMIT 1;

    IF linked_schedule_report_id IS NOT NULL THEN
      -- Get all building_admin user IDs
      SELECT array_agg(ur.user_id) INTO ba_user_ids
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE r.name = 'building_admin';

      -- Create notifications for each BA
      IF ba_user_ids IS NOT NULL AND array_length(ba_user_ids, 1) > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, type, source_type, source_id, action_url)
        SELECT
          unnest(ba_user_ids),
          'Equipment Issue Resolved — Schedule Report',
          'An equipment issue linked to a schedule report has been resolved. Please review and close the schedule report.',
          'success',
          'schedule_issue_report',
          linked_schedule_report_id,
          '/admin/building/facility-management';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ba_on_equipment_resolution
  AFTER UPDATE ON public.equipment_issue_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ba_on_equipment_resolution();

COMMENT ON FUNCTION public.notify_ba_on_equipment_resolution()
  IS 'Notifies Building Admins when an escalated equipment report is resolved, so they can close the linked schedule report';
