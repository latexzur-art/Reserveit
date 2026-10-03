-- =====================================================
-- Schedule Issue Report Attachments: Photo evidence for reports
-- =====================================================
-- Description: Allows users to attach photos to schedule issue reports.
--   Images are compressed client-side to WebP (max 500KB) and stored in
--   Supabase Storage. Only Building Admin can view attachments.
-- Date: 2026-08-11
-- =====================================================

CREATE TABLE IF NOT EXISTS public.schedule_issue_report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.schedule_issue_reports(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  file_size INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_issue_report_attachments_report
  ON public.schedule_issue_report_attachments(report_id);

ALTER TABLE public.schedule_issue_report_attachments ENABLE ROW LEVEL SECURITY;

-- Service role can manage all attachments (admin API uses this)
CREATE POLICY "Service role can manage report attachments"
  ON public.schedule_issue_report_attachments FOR ALL
  USING (auth.role() = 'service_role');

-- Users can create attachments for their own reports
CREATE POLICY "Users can create attachments for own reports"
  ON public.schedule_issue_report_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedule_issue_reports r
      WHERE r.id = report_id AND r.reported_by = auth.uid()
    )
  );

-- Users can delete their own attachments (before triage)
CREATE POLICY "Users can delete own attachments"
  ON public.schedule_issue_report_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_issue_reports r
      WHERE r.id = report_id AND r.reported_by = auth.uid()
    )
  );

COMMENT ON TABLE public.schedule_issue_report_attachments
  IS 'Photo attachments for schedule issue reports. Compressed to WebP, max 500KB. Only BA can view.';
