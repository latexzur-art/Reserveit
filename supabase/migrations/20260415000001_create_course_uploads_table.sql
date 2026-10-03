-- Create course_uploads table
-- Tracks batch curriculum uploads submitted by program heads for academic head review.

CREATE TABLE IF NOT EXISTS public.course_uploads (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id      UUID          REFERENCES public.departments(id)     ON DELETE SET NULL,
  academic_term_id   UUID          REFERENCES public.academic_terms(id)  ON DELETE SET NULL,
  upload_mode        TEXT          NOT NULL CHECK (upload_mode IN ('file_upload', 'manual_entry', 'grid_entry')),
  upload_status      TEXT          NOT NULL DEFAULT 'draft'
                                   CHECK (upload_status IN (
                                     'draft', 'parsing', 'parsed', 'validation_failed',
                                     'pending_submission', 'submitted', 'approved',
                                     'partially_rejected', 'rejected'
                                   )),
  source_file_name   TEXT,
  source_file_type   TEXT          CHECK (source_file_type IN ('csv', 'xlsx', 'xls')),
  source_file_path   TEXT,
  source_file_size   INTEGER,
  total_entries      INTEGER       NOT NULL DEFAULT 0,
  approved_count     INTEGER       NOT NULL DEFAULT 0,
  rejected_count     INTEGER       NOT NULL DEFAULT 0,
  pending_count      INTEGER       NOT NULL DEFAULT 0,
  uploaded_by        UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  submitted_at       TIMESTAMPTZ,
  reviewed_by        UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  review_notes       TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_uploads_uploaded_by   ON public.course_uploads(uploaded_by);
CREATE INDEX idx_course_uploads_status        ON public.course_uploads(upload_status);
CREATE INDEX idx_course_uploads_dept_term     ON public.course_uploads(department_id, academic_term_id);
CREATE INDEX idx_course_uploads_submitted_at  ON public.course_uploads(submitted_at DESC) WHERE submitted_at IS NOT NULL;

-- Row-level security
ALTER TABLE public.course_uploads ENABLE ROW LEVEL SECURITY;

-- Program heads can view and manage their own uploads
CREATE POLICY "program_head_own_uploads"
  ON public.course_uploads
  FOR ALL
  USING (uploaded_by = auth.uid());

-- Academic heads can view all submitted/reviewed batches
CREATE POLICY "academic_head_view_all"
  ON public.course_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'academic_head'
        AND ur.is_active = true
    )
  );

-- Service role bypasses RLS (used by backend services)
