-- =====================================================
-- Schedule Issue Reports: User-filed reports about schedule problems
-- =====================================================
-- Description: Allows faculty, program heads, and academic heads to report
--   issues with class schedules and reservations (wrong room, time conflicts,
--   missing sessions, etc.). Building Admin triages; escalation routes to
--   the equipment issue report pipeline (IT Admin for tech, PAMO for non-tech).
--   Every status change is logged in an activity log table.
-- Date: 2026-08-11
-- =====================================================

-- 1. Main reports table
CREATE TABLE IF NOT EXISTS public.schedule_issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic schedule reference
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('class', 'reservation')),
  schedule_id UUID NOT NULL,        -- FK to class_schedules.id or bookings.id (polymorphic, no hard FK)
  -- Context snapshots (survive deletion of source records)
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  facility_name TEXT,
  course_code TEXT,                  -- for class schedules
  section TEXT,                      -- for class schedules
  schedule_date DATE,                -- for reservations
  start_time TIME,
  end_time TIME,
  day_of_week SMALLINT,
  -- Report data
  reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'wrong_room', 'time_conflict', 'missing_session',
    'incorrect_time', 'instructor_mismatch', 'not_updated', 'other'
  )),
  noticed_at DATE NOT NULL DEFAULT CURRENT_DATE,  -- when the user noticed the issue
  what_happened TEXT NOT NULL,                     -- what happened (required)
  what_to_correct TEXT,                            -- what should be fixed (optional)
  -- Triage
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed', 'escalated')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  -- Escalation (links to equipment pipeline when report involves equipment)
  escalated_equipment_report_id UUID REFERENCES public.equipment_issue_reports(id) ON DELETE SET NULL,
  escalated_to TEXT CHECK (escalated_to IS NULL OR escalated_to IN ('it_admin', 'pamo')),
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedule_issue_reports_status
  ON public.schedule_issue_reports(status) WHERE status IN ('pending', 'under_review');
CREATE INDEX IF NOT EXISTS idx_schedule_issue_reports_schedule
  ON public.schedule_issue_reports(schedule_type, schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_issue_reports_reported_by
  ON public.schedule_issue_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_schedule_issue_reports_created_at
  ON public.schedule_issue_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_issue_reports_facility
  ON public.schedule_issue_reports(facility_id) WHERE facility_id IS NOT NULL;

-- RLS
ALTER TABLE public.schedule_issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule issue reports"
  ON public.schedule_issue_reports FOR SELECT
  USING (reported_by = auth.uid());

CREATE POLICY "Users can file schedule issue reports"
  ON public.schedule_issue_reports FOR INSERT
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Service role can manage schedule issue reports"
  ON public.schedule_issue_reports FOR ALL
  USING (auth.role() = 'service_role');

-- Updated-at trigger
CREATE TRIGGER trg_schedule_issue_reports_updated_at
  BEFORE UPDATE ON public.schedule_issue_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 2. Activity log -- every status change is recorded
CREATE TABLE IF NOT EXISTS public.schedule_issue_report_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.schedule_issue_reports(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'status_changed', 'note_added', 'escalated'
  )),
  old_status TEXT,                   -- for status_changed
  new_status TEXT,                   -- for status_changed
  notes TEXT,                        -- admin notes or resolution notes
  performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_issue_report_logs_report
  ON public.schedule_issue_report_logs(report_id, created_at);

ALTER TABLE public.schedule_issue_report_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage schedule issue report logs"
  ON public.schedule_issue_report_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own report logs"
  ON public.schedule_issue_report_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_issue_reports r
      WHERE r.id = report_id AND r.reported_by = auth.uid()
    )
  );


-- 3. Auto-log trigger: every INSERT/UPDATE on reports table logs the action
CREATE OR REPLACE FUNCTION public.log_schedule_issue_report_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.schedule_issue_report_logs
      (report_id, action, new_status, performed_by)
    VALUES (NEW.id, 'created', NEW.status, NEW.reported_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.schedule_issue_report_logs
      (report_id, action, old_status, new_status, notes, performed_by)
    VALUES (
      NEW.id, 'status_changed', OLD.status, NEW.status,
      NEW.resolution_notes, NEW.resolved_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_schedule_issue_report_change
  AFTER INSERT OR UPDATE ON public.schedule_issue_reports
  FOR EACH ROW EXECUTE FUNCTION public.log_schedule_issue_report_change();


COMMENT ON TABLE public.schedule_issue_reports
  IS 'User-filed reports about schedule problems (wrong room, conflicts, missing sessions, etc.)';
COMMENT ON TABLE public.schedule_issue_report_logs
  IS 'Activity log for schedule issue reports -- every status change is recorded with who, when, and notes.';
