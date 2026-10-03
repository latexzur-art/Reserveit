-- =====================================================
-- Create equipment_issue_reports table
-- =====================================================
-- Description: Professor/BA-filed equipment problem reports. BA triages;
--   escalation routes by is_tech (non-tech -> PAMO, tech -> IT Admin).
-- Date: 2026-08-06
-- =====================================================

CREATE TABLE IF NOT EXISTS public.equipment_issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  equipment_code TEXT,                       -- snapshot (survives item deletion)
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  reported_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('broken','missing','malfunction','other')),
  description TEXT NOT NULL,
  is_tech BOOLEAN NOT NULL DEFAULT false,    -- snapshot of managed_by='it' -> routing
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_process','resolved','still_broken','escalated')),
  handled_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  escalated_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS equipment_issue_reports_status_idx ON public.equipment_issue_reports(status);
CREATE INDEX IF NOT EXISTS equipment_issue_reports_is_tech_idx ON public.equipment_issue_reports(is_tech);
CREATE INDEX IF NOT EXISTS equipment_issue_reports_equipment_id_idx ON public.equipment_issue_reports(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_issue_reports_reported_by_idx ON public.equipment_issue_reports(reported_by_user_id);
CREATE INDEX IF NOT EXISTS equipment_issue_reports_created_at_idx ON public.equipment_issue_reports(created_at DESC);

ALTER TABLE public.equipment_issue_reports ENABLE ROW LEVEL SECURITY;

-- RLS: coarse, matching equipment_status_log. Role-scoped reads/triage are
-- enforced at the API layer via the service-role client.
CREATE POLICY "Authenticated users can view equipment issue reports"
  ON public.equipment_issue_reports FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can file equipment issue reports"
  ON public.equipment_issue_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage equipment issue reports"
  ON public.equipment_issue_reports FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_equipment_issue_reports_updated_at
  BEFORE UPDATE ON public.equipment_issue_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.equipment_issue_reports IS 'Professor/BA-filed equipment problem reports with triage + escalation lifecycle';
COMMENT ON COLUMN public.equipment_issue_reports.is_tech IS 'Snapshot of managed_by=it at report time; drives escalation routing';
