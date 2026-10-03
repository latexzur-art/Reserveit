-- Create term_course_activations table
-- Links approved courses to academic terms, tracking whether each course
-- is actively offered in a given term (auto-populated on batch approval,
-- manually overridable by the academic head).

CREATE TABLE IF NOT EXISTS public.term_course_activations (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID          NOT NULL REFERENCES public.courses(id)        ON DELETE CASCADE,
  academic_term_id  UUID          NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  activation_method TEXT          NOT NULL DEFAULT 'auto'
                                  CHECK (activation_method IN ('auto', 'manual_override')),
  activated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deactivated_at    TIMESTAMPTZ,
  deactivated_by    UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- A course may only appear once per term
  UNIQUE (course_id, academic_term_id)
);

CREATE INDEX idx_tca_course      ON public.term_course_activations(course_id);
CREATE INDEX idx_tca_term        ON public.term_course_activations(academic_term_id);
CREATE INDEX idx_tca_active_term ON public.term_course_activations(academic_term_id, is_active);

-- Row-level security
ALTER TABLE public.term_course_activations ENABLE ROW LEVEL SECURITY;

-- All authenticated internal users can read term offerings (faculty needs them for schedule uploads)
CREATE POLICY "authenticated_read_term_offerings"
  ON public.term_course_activations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only academic heads (and service role) can insert/update/delete
CREATE POLICY "academic_head_manage_activations"
  ON public.term_course_activations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'academic_head'
        AND ur.is_active = true
    )
  );

-- Auto-activate function: called by approveBatch via onCourseApproved flow
-- Creates or re-activates the activation record for a course in its batch's term.
CREATE OR REPLACE FUNCTION auto_activate_courses_for_term(p_term_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO public.term_course_activations (course_id, academic_term_id, is_active, activation_method)
  SELECT
    c.id,
    cu.academic_term_id,
    TRUE,
    'auto'
  FROM public.courses c
  JOIN public.course_uploads cu ON cu.id = c.batch_upload_id
  WHERE cu.academic_term_id = p_term_id
    AND c.approval_status = 'approved'
    AND c.is_active = TRUE
  ON CONFLICT (course_id, academic_term_id)
  DO UPDATE SET
    is_active         = TRUE,
    activation_method = 'auto',
    activated_at      = NOW(),
    deactivated_at    = NULL,
    deactivated_by    = NULL,
    updated_at        = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
