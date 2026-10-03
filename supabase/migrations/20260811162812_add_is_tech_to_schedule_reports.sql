-- Add is_tech column to schedule_issue_reports for equipment issue classification.
-- When category is 'equipment_issue', is_tech indicates whether the equipment is
-- IT-managed (tech) or PAMO-managed (non-tech), used for escalation routing.

ALTER TABLE public.schedule_issue_reports
  ADD COLUMN IF NOT EXISTS is_tech BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.schedule_issue_reports.is_tech
  IS 'Whether the reported equipment is IT-managed (tech) or non-tech. Set when category is equipment_issue.';
