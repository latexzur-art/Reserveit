-- Create courses table
-- Stores individual course entries within a course_uploads batch.

CREATE TABLE IF NOT EXISTS public.courses (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_upload_id     UUID          NOT NULL REFERENCES public.course_uploads(id) ON DELETE CASCADE,
  department_code     VARCHAR(20)   NOT NULL,
  course_code         VARCHAR(20)   NOT NULL,
  course_name         TEXT          NOT NULL,
  units               INTEGER       NOT NULL CHECK (units > 0),
  year_level          INTEGER       NOT NULL CHECK (year_level BETWEEN 1 AND 5),
  term                INTEGER       NOT NULL CHECK (term BETWEEN 1 AND 3),
  delivery_mode       TEXT          NOT NULL CHECK (delivery_mode IN ('lecture', 'lab', 'both')),
  lecture_hours       NUMERIC(4,1),
  lab_hours           NUMERIC(4,1),
  prerequisite_codes  TEXT[],
  is_elective         BOOLEAN       NOT NULL DEFAULT FALSE,
  approval_status     TEXT          NOT NULL DEFAULT 'pending'
                                    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'sent_back')),
  approved_by         UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_batch            ON public.courses(batch_upload_id);
CREATE INDEX idx_courses_dept_code        ON public.courses(department_code, course_code);
CREATE INDEX idx_courses_approval_status  ON public.courses(approval_status);
CREATE INDEX idx_courses_active           ON public.courses(is_active) WHERE is_active = true;

-- Row-level security
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Program heads can view courses in their own batches
CREATE POLICY "program_head_own_batch_courses"
  ON public.courses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.course_uploads cu
      WHERE cu.id = courses.batch_upload_id
        AND cu.uploaded_by = auth.uid()
    )
  );

-- Academic heads can view all courses
CREATE POLICY "academic_head_view_all_courses"
  ON public.courses
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
