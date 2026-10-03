-- =====================================================
-- Phase 1.2: Create Class Schedules Table
-- =====================================================
-- Description: Approved class schedules (source of truth for conflict detection)
-- Date: 2026-02-02
-- =====================================================

-- Create class_schedules table
CREATE TABLE IF NOT EXISTS public.class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origin tracking
  schedule_upload_id UUID REFERENCES public.schedule_uploads(id) ON DELETE SET NULL,
  staging_entry_id UUID,                           -- Original staging entry (for audit)

  -- Relationships
  academic_term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,

  -- Course information
  course_code VARCHAR(50) NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  section VARCHAR(50) NOT NULL,

  -- Instructor
  instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  instructor_name VARCHAR(255) NOT NULL,

  -- Schedule timing
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Effective dates (defaults to term dates)
  effective_start_date DATE NOT NULL,
  effective_end_date DATE NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Versioning (for mid-semester changes)
  version INT DEFAULT 1,
  superseded_by UUID REFERENCES public.class_schedules(id) ON DELETE SET NULL,
  superseded_at TIMESTAMP WITH TIME ZONE,
  supersede_reason TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_schedule_time CHECK (end_time > start_time),
  CONSTRAINT valid_effective_range CHECK (effective_end_date >= effective_start_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS class_schedules_term_idx ON public.class_schedules(academic_term_id);
CREATE INDEX IF NOT EXISTS class_schedules_dept_idx ON public.class_schedules(department_id);
CREATE INDEX IF NOT EXISTS class_schedules_facility_idx ON public.class_schedules(facility_id);
CREATE INDEX IF NOT EXISTS class_schedules_active_idx ON public.class_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS class_schedules_instructor_idx ON public.class_schedules(instructor_id);
CREATE INDEX IF NOT EXISTS class_schedules_course_idx ON public.class_schedules(course_code, section);
CREATE INDEX IF NOT EXISTS class_schedules_day_time_idx ON public.class_schedules(day_of_week, start_time, end_time);

-- Composite index for conflict detection queries
CREATE INDEX IF NOT EXISTS class_schedules_conflict_check_idx
  ON public.class_schedules(facility_id, day_of_week, start_time, end_time, academic_term_id)
  WHERE is_active = TRUE;

-- Unique constraint: No double-booking of same room at same time
CREATE UNIQUE INDEX IF NOT EXISTS class_schedules_no_overlap_idx
  ON public.class_schedules(facility_id, academic_term_id, day_of_week, start_time)
  WHERE is_active = TRUE AND superseded_by IS NULL;

-- Enable Row Level Security
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active schedules (needed for conflict detection)
CREATE POLICY "Public read for active schedules"
  ON public.class_schedules FOR SELECT
  USING (is_active = TRUE);

-- Service role has full access
CREATE POLICY "Service role can manage class schedules"
  ON public.class_schedules FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_class_schedules_updated_at
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check schedule conflicts
CREATE OR REPLACE FUNCTION public.check_schedule_conflict(
  p_facility_id UUID,
  p_term_id UUID,
  p_day_of_week INT,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  conflicting_id UUID,
  conflict_type TEXT,
  details JSONB
) AS $$
BEGIN
  -- Check against approved class schedules
  RETURN QUERY
  SELECT
    cs.id,
    'class_schedule'::TEXT,
    jsonb_build_object(
      'course_code', cs.course_code,
      'section', cs.section,
      'time', cs.start_time::TEXT || '-' || cs.end_time::TEXT,
      'instructor', cs.instructor_name,
      'department_id', cs.department_id
    )
  FROM public.class_schedules cs
  WHERE cs.facility_id = p_facility_id
    AND cs.academic_term_id = p_term_id
    AND cs.day_of_week = p_day_of_week
    AND cs.is_active = TRUE
    AND cs.superseded_by IS NULL
    AND (p_exclude_id IS NULL OR cs.id != p_exclude_id)
    AND (
      (p_start_time >= cs.start_time AND p_start_time < cs.end_time) OR
      (p_end_time > cs.start_time AND p_end_time <= cs.end_time) OR
      (p_start_time <= cs.start_time AND p_end_time >= cs.end_time)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check booking against class schedules
CREATE OR REPLACE FUNCTION public.check_booking_against_schedules(
  p_facility_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS TABLE (
  conflicting_id UUID,
  course_code VARCHAR,
  section VARCHAR,
  instructor_name VARCHAR,
  schedule_start TIME,
  schedule_end TIME
) AS $$
DECLARE
  v_day_of_week INT;
  v_term_id UUID;
BEGIN
  -- Get day of week (0=Sunday)
  v_day_of_week := EXTRACT(DOW FROM p_booking_date);

  -- Get active term for the date
  SELECT id INTO v_term_id
  FROM public.academic_terms
  WHERE p_booking_date >= start_date
    AND p_booking_date <= end_date
    AND is_active = TRUE
  LIMIT 1;

  IF v_term_id IS NULL THEN
    -- No active term, no conflicts
    RETURN;
  END IF;

  -- Return conflicting schedules
  RETURN QUERY
  SELECT
    cs.id,
    cs.course_code,
    cs.section,
    cs.instructor_name,
    cs.start_time,
    cs.end_time
  FROM public.class_schedules cs
  WHERE cs.facility_id = p_facility_id
    AND cs.academic_term_id = v_term_id
    AND cs.day_of_week = v_day_of_week
    AND cs.is_active = TRUE
    AND cs.superseded_by IS NULL
    AND p_booking_date >= cs.effective_start_date
    AND p_booking_date <= cs.effective_end_date
    AND (
      (p_start_time >= cs.start_time AND p_start_time < cs.end_time) OR
      (p_end_time > cs.start_time AND p_end_time <= cs.end_time) OR
      (p_start_time <= cs.start_time AND p_end_time >= cs.end_time)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finalize schedule upload (copy from staging to class_schedules)
CREATE OR REPLACE FUNCTION public.finalize_schedule_upload(
  p_upload_id UUID,
  p_reviewer_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_upload RECORD;
  v_entry RECORD;
  v_term RECORD;
  v_new_schedule_id UUID;
  v_count_created INT := 0;
BEGIN
  SELECT * INTO v_upload FROM public.schedule_uploads WHERE id = p_upload_id;

  -- Verify can be finalized
  IF v_upload.upload_status != 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Upload must be in submitted status');
  END IF;

  IF v_upload.error_entries_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot finalize with errors');
  END IF;

  -- Get term dates
  SELECT * INTO v_term FROM public.academic_terms WHERE id = v_upload.academic_term_id;

  -- Copy valid entries to class_schedules
  FOR v_entry IN
    SELECT * FROM public.schedule_entries_staging
    WHERE schedule_upload_id = p_upload_id
    AND validation_status IN ('valid', 'warning')
  LOOP
    INSERT INTO public.class_schedules (
      schedule_upload_id, staging_entry_id, academic_term_id, department_id,
      facility_id, course_code, course_name, section,
      instructor_id, instructor_name, day_of_week, start_time, end_time,
      effective_start_date, effective_end_date
    ) VALUES (
      p_upload_id, v_entry.id, v_upload.academic_term_id, v_upload.department_id,
      v_entry.facility_id, v_entry.course_code, v_entry.course_name, v_entry.section,
      v_entry.instructor_id, v_entry.instructor_name, v_entry.day_of_week,
      v_entry.start_time, v_entry.end_time,
      COALESCE(v_entry.effective_start_date, v_term.start_date),
      COALESCE(v_entry.effective_end_date, v_term.end_date)
    )
    RETURNING id INTO v_new_schedule_id;

    v_count_created := v_count_created + 1;
  END LOOP;

  -- Update upload status
  UPDATE public.schedule_uploads SET
    upload_status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_upload_id;

  RETURN jsonb_build_object(
    'success', true,
    'schedules_created', v_count_created
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get facility schedule for a day
CREATE OR REPLACE FUNCTION public.get_facility_schedule(
  p_facility_id UUID,
  p_date DATE
)
RETURNS TABLE (
  schedule_id UUID,
  course_code VARCHAR,
  course_name VARCHAR,
  section VARCHAR,
  instructor_name VARCHAR,
  start_time TIME,
  end_time TIME,
  department_id UUID
) AS $$
DECLARE
  v_day_of_week INT;
  v_term_id UUID;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Get term for date
  SELECT id INTO v_term_id
  FROM public.academic_terms
  WHERE p_date >= start_date AND p_date <= end_date
  LIMIT 1;

  RETURN QUERY
  SELECT
    cs.id,
    cs.course_code,
    cs.course_name,
    cs.section,
    cs.instructor_name,
    cs.start_time,
    cs.end_time,
    cs.department_id
  FROM public.class_schedules cs
  WHERE cs.facility_id = p_facility_id
    AND (v_term_id IS NULL OR cs.academic_term_id = v_term_id)
    AND cs.day_of_week = v_day_of_week
    AND cs.is_active = TRUE
    AND cs.superseded_by IS NULL
    AND p_date >= cs.effective_start_date
    AND p_date <= cs.effective_end_date
  ORDER BY cs.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.class_schedules IS 'Approved class schedules - source of truth for booking conflict detection';
COMMENT ON COLUMN public.class_schedules.staging_entry_id IS 'Reference to original staging entry for audit trail';
COMMENT ON COLUMN public.class_schedules.version IS 'Version number for mid-semester change tracking';
COMMENT ON COLUMN public.class_schedules.superseded_by IS 'Points to newer version if this schedule was modified';
COMMENT ON COLUMN public.class_schedules.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON FUNCTION public.check_schedule_conflict IS 'Checks for conflicts with existing class schedules';
COMMENT ON FUNCTION public.check_booking_against_schedules IS 'Checks if a booking conflicts with class schedules';
COMMENT ON FUNCTION public.finalize_schedule_upload IS 'Approves upload and copies entries to class_schedules';
COMMENT ON FUNCTION public.get_facility_schedule IS 'Gets all classes scheduled for a facility on a given date';
