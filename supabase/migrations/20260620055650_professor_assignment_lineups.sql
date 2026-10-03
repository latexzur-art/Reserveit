-- =====================================================
-- Professor Assignment Lineups
-- =====================================================
-- Description: Standalone governance workflow for assigning professors to
--   class_schedules sections that were published Unassigned (instructor_id NULL,
--   sentinel name 'TBD'). Program head proposes a batch "lineup"; academic head
--   approves it (or self-assigns directly). Decoupled from the schedule upload
--   pipeline — operates on live class_schedules only, via the proven
--   insert-new-version + supersede-original path (mirrors approve_change_request).
-- Date: 2026-06-20
-- =====================================================

-- Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE assignment_lineup_status AS ENUM (
    'draft', 'pending', 'approved', 'rejected', 'partially_approved'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_item_status AS ENUM (
    'pending', 'approved', 'rejected', 'conflict'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Find-unassigned index ----------------------------------------------------
CREATE INDEX IF NOT EXISTS class_schedules_unassigned_idx
  ON public.class_schedules(department_id, is_active)
  WHERE instructor_id IS NULL;

-- Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professor_assignment_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  academic_term_id UUID REFERENCES public.academic_terms(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status assignment_lineup_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.professor_assignment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id UUID NOT NULL REFERENCES public.professor_assignment_lineups(id) ON DELETE CASCADE,
  class_schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE RESTRICT,
  proposed_instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  proposed_instructor_name VARCHAR(255) NOT NULL,
  status assignment_item_status NOT NULL DEFAULT 'pending',
  conflict_details JSONB,
  resulting_schedule_id UUID REFERENCES public.class_schedules(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assignment_lineups_dept_idx ON public.professor_assignment_lineups(department_id);
CREATE INDEX IF NOT EXISTS assignment_lineups_status_idx ON public.professor_assignment_lineups(status);
CREATE INDEX IF NOT EXISTS assignment_lineups_creator_idx ON public.professor_assignment_lineups(created_by);
CREATE INDEX IF NOT EXISTS assignment_items_lineup_idx ON public.professor_assignment_items(lineup_id);
CREATE INDEX IF NOT EXISTS assignment_items_instructor_idx ON public.professor_assignment_items(proposed_instructor_id);

-- RLS (mirrors schedule_change_requests: own-rows for users, service_role full)
ALTER TABLE public.professor_assignment_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_assignment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own lineups"
  ON public.professor_assignment_lineups FOR SELECT
  USING (created_by = auth.uid());
CREATE POLICY "Users create lineups"
  ON public.professor_assignment_lineups FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users update own draft lineups"
  ON public.professor_assignment_lineups FOR UPDATE
  USING (created_by = auth.uid() AND status = 'draft')
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users delete own draft lineups"
  ON public.professor_assignment_lineups FOR DELETE
  USING (created_by = auth.uid() AND status = 'draft');
CREATE POLICY "Service role manages lineups"
  ON public.professor_assignment_lineups FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users view items of own lineups"
  ON public.professor_assignment_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.professor_assignment_lineups l
    WHERE l.id = lineup_id AND l.created_by = auth.uid()
  ));
CREATE POLICY "Service role manages items"
  ON public.professor_assignment_items FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_assignment_lineups_updated_at
  BEFORE UPDATE ON public.professor_assignment_lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPCs ---------------------------------------------------------------------

-- Submit: draft -> pending (program-head path; AH approves directly instead).
CREATE OR REPLACE FUNCTION public.submit_assignment_lineup(p_lineup_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.professor_assignment_lineups
  SET status = 'pending', updated_at = NOW()
  WHERE id = p_lineup_id AND status = 'draft';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve: applies each non-rejected item via the versioning path. Items whose
-- proposed instructor conflicts at approval time are skipped (status='conflict').
-- Header becomes 'approved' if all applied, else 'partially_approved'.
-- Accepts 'pending' (PH lineup) or 'draft' (AH self-assign, no wait).
CREATE OR REPLACE FUNCTION public.approve_assignment_lineup(
  p_lineup_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_lineup RECORD;
  v_item RECORD;
  v_orig RECORD;
  v_new_id UUID;
  v_conflict RECORD;
  v_applied INT := 0;
  v_skipped INT := 0;
BEGIN
  SELECT * INTO v_lineup FROM public.professor_assignment_lineups WHERE id = p_lineup_id;
  IF v_lineup IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lineup not found');
  END IF;
  IF v_lineup.status NOT IN ('pending', 'draft') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lineup must be pending or draft');
  END IF;

  FOR v_item IN
    SELECT * FROM public.professor_assignment_items
    WHERE lineup_id = p_lineup_id AND status <> 'rejected'
  LOOP
    SELECT * INTO v_orig FROM public.class_schedules WHERE id = v_item.class_schedule_id;

    -- Target row must still be active; skip stale items.
    IF v_orig IS NULL OR v_orig.is_active = FALSE THEN
      UPDATE public.professor_assignment_items
      SET status = 'conflict',
          conflict_details = jsonb_build_object('reason', 'Target schedule no longer active')
      WHERE id = v_item.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Re-check: is the proposed instructor already teaching at this day/time?
    IF v_item.proposed_instructor_id IS NOT NULL THEN
      SELECT cs.id, cs.course_code, cs.section INTO v_conflict
      FROM public.class_schedules cs
      WHERE cs.is_active = TRUE
        AND cs.instructor_id = v_item.proposed_instructor_id
        AND cs.day_of_week = v_orig.day_of_week
        AND cs.id <> v_orig.id
        AND cs.start_time < v_orig.end_time
        AND cs.end_time > v_orig.start_time
      LIMIT 1;

      IF v_conflict.id IS NOT NULL THEN
        UPDATE public.professor_assignment_items
        SET status = 'conflict',
            conflict_details = jsonb_build_object(
              'reason', 'Instructor already teaching',
              'conflicting_course', v_conflict.course_code,
              'conflicting_section', v_conflict.section
            )
        WHERE id = v_item.id;
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Apply: new version + supersede original (mirrors approve_change_request).
    INSERT INTO public.class_schedules (
      schedule_upload_id, staging_entry_id, academic_term_id, department_id,
      facility_id, course_code, course_name, section, session_type,
      instructor_id, instructor_name, day_of_week, start_time, end_time,
      effective_start_date, effective_end_date, is_active, version
    ) VALUES (
      v_orig.schedule_upload_id, v_orig.staging_entry_id, v_orig.academic_term_id, v_orig.department_id,
      v_orig.facility_id, v_orig.course_code, v_orig.course_name, v_orig.section, v_orig.session_type,
      v_item.proposed_instructor_id, v_item.proposed_instructor_name, v_orig.day_of_week, v_orig.start_time, v_orig.end_time,
      v_orig.effective_start_date, v_orig.effective_end_date, TRUE, COALESCE(v_orig.version, 1) + 1
    )
    RETURNING id INTO v_new_id;

    UPDATE public.class_schedules
    SET is_active = FALSE, superseded_by = v_new_id, superseded_at = NOW(),
        supersede_reason = 'Professor assigned', updated_at = NOW()
    WHERE id = v_orig.id;

    UPDATE public.professor_assignment_items
    SET status = 'approved', resulting_schedule_id = v_new_id, conflict_details = NULL
    WHERE id = v_item.id;
    v_applied := v_applied + 1;
  END LOOP;

  UPDATE public.professor_assignment_lineups
  SET status = CASE WHEN v_skipped > 0 THEN 'partially_approved'::assignment_lineup_status
                    ELSE 'approved'::assignment_lineup_status END,
      reviewed_by = p_reviewer_id, reviewed_at = NOW(), review_notes = p_notes, updated_at = NOW()
  WHERE id = p_lineup_id;

  RETURN jsonb_build_object('success', true, 'applied', v_applied, 'skipped', v_skipped);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reject_assignment_lineup(
  p_lineup_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.professor_assignment_lineups
  SET status = 'rejected', reviewed_by = p_reviewer_id, reviewed_at = NOW(),
      review_notes = p_notes, updated_at = NOW()
  WHERE id = p_lineup_id AND status IN ('pending', 'draft');
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notification source_type ------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_source_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_source_type_check CHECK (
      source_type IS NULL OR source_type IN (
        'booking', 'booking_reminder', 'schedule_upload', 'schedule_entry', 'schedule',
        'schedule_conflict', 'schedule_change_request', 'facility_block', 'broadcast',
        'admin_message', 'restriction', 'payment', 'system', 'override', 'message',
        'appeal', 'change_request', 'maintenance', 'user', 'score_reset',
        'score_reset_request', 'course_upload', 'emergency_request', 'session_credit',
        'password_reset_request', 'reschedule_offer', 'special_event',
        'professor_assignment'
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.professor_assignment_lineups IS 'Batch professor-assignment proposals for Unassigned live sections; one AH approval per lineup';
COMMENT ON TABLE public.professor_assignment_items IS 'Per-section proposed professor within a lineup; applied via class_schedules versioning on approval';
