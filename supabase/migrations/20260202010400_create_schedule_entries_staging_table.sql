-- =====================================================
-- Phase 1.2: Create Schedule Entries Staging Table
-- =====================================================
-- Description: Draft schedule entries awaiting validation and approval
-- Date: 2026-02-02
-- =====================================================

-- Create entry_source enum
DO $$ BEGIN
  CREATE TYPE entry_source AS ENUM ('file_parsed', 'manual_entry');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create validation_status enum
DO $$ BEGIN
  CREATE TYPE validation_status AS ENUM ('pending', 'valid', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create schedule_entries_staging table
CREATE TABLE IF NOT EXISTS public.schedule_entries_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent reference
  schedule_upload_id UUID NOT NULL REFERENCES public.schedule_uploads(id) ON DELETE CASCADE,

  -- Source tracking
  entry_source entry_source NOT NULL,
  row_number INT,                                  -- Original row in uploaded file (for error reference)

  -- Facility mapping
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  facility_name_raw VARCHAR(255) NOT NULL,         -- Original text from file/input
  facility_match_confidence DECIMAL(3,2),          -- 0.00-1.00, for fuzzy matching feedback

  -- Course information
  course_code VARCHAR(50) NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  section VARCHAR(50) NOT NULL,

  -- Instructor
  instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  instructor_name VARCHAR(255) NOT NULL,           -- Raw input, may not match system user

  -- Schedule timing
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Optional overrides
  effective_start_date DATE,                       -- If different from term start
  effective_end_date DATE,                         -- If different from term end

  -- Validation state
  validation_status validation_status DEFAULT 'pending',
  validation_errors JSONB DEFAULT '[]',            -- Array of error objects
  validation_warnings JSONB DEFAULT '[]',          -- Array of warning objects

  -- Conflict tracking
  has_internal_conflict BOOLEAN DEFAULT FALSE,     -- Conflicts within same upload
  has_external_conflict BOOLEAN DEFAULT FALSE,     -- Conflicts with other departments
  conflict_entry_ids UUID[] DEFAULT '{}',          -- References to conflicting entries
  conflict_schedule_ids UUID[] DEFAULT '{}',       -- References to conflicting approved schedules

  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT FALSE,               -- User acknowledged/fixed issue
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_effective_dates CHECK (
    effective_end_date IS NULL OR effective_start_date IS NULL
    OR effective_end_date >= effective_start_date
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS staging_upload_idx ON public.schedule_entries_staging(schedule_upload_id);
CREATE INDEX IF NOT EXISTS staging_facility_idx ON public.schedule_entries_staging(facility_id);
CREATE INDEX IF NOT EXISTS staging_validation_idx ON public.schedule_entries_staging(validation_status);
CREATE INDEX IF NOT EXISTS staging_conflicts_idx ON public.schedule_entries_staging(has_internal_conflict, has_external_conflict);
CREATE INDEX IF NOT EXISTS staging_day_time_idx ON public.schedule_entries_staging(day_of_week, start_time, end_time);
CREATE INDEX IF NOT EXISTS staging_course_idx ON public.schedule_entries_staging(course_code, section);

-- GIN index for JSONB validation errors (searchable)
CREATE INDEX IF NOT EXISTS staging_errors_gin_idx ON public.schedule_entries_staging USING GIN (validation_errors);

-- Enable Row Level Security
ALTER TABLE public.schedule_entries_staging ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view entries for their uploads
CREATE POLICY "Users can view own upload entries"
  ON public.schedule_entries_staging FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_uploads su
      WHERE su.id = schedule_upload_id
      AND su.uploaded_by = auth.uid()
    )
  );

-- Users can create entries for their uploads
CREATE POLICY "Users can create entries for own uploads"
  ON public.schedule_entries_staging FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedule_uploads su
      WHERE su.id = schedule_upload_id
      AND su.uploaded_by = auth.uid()
      AND su.upload_status IN ('draft', 'validation_failed', 'pending_submission', 'revision_requested')
    )
  );

-- Users can update entries for their draft uploads
CREATE POLICY "Users can update own upload entries"
  ON public.schedule_entries_staging FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_uploads su
      WHERE su.id = schedule_upload_id
      AND su.uploaded_by = auth.uid()
      AND su.upload_status IN ('draft', 'validation_failed', 'pending_submission', 'revision_requested')
    )
  );

-- Users can delete entries from their draft uploads
CREATE POLICY "Users can delete own upload entries"
  ON public.schedule_entries_staging FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_uploads su
      WHERE su.id = schedule_upload_id
      AND su.uploaded_by = auth.uid()
      AND su.upload_status IN ('draft', 'validation_failed', 'pending_submission', 'revision_requested')
    )
  );

-- Service role has full access
CREATE POLICY "Service role can manage staging entries"
  ON public.schedule_entries_staging FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_staging_entries_updated_at
  BEFORE UPDATE ON public.schedule_entries_staging
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to validate a staging entry
CREATE OR REPLACE FUNCTION public.validate_staging_entry(p_entry_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_errors JSONB := '[]';
  v_warnings JSONB := '[]';
  v_facility_match UUID;
  v_status validation_status;
BEGIN
  SELECT * INTO v_entry FROM public.schedule_entries_staging WHERE id = p_entry_id;

  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry not found');
  END IF;

  -- Check facility exists
  IF v_entry.facility_id IS NULL THEN
    -- Try alias matching
    v_facility_match := public.find_facility_by_alias(v_entry.facility_name_raw);

    IF v_facility_match IS NOT NULL THEN
      UPDATE public.schedule_entries_staging
      SET facility_id = v_facility_match, facility_match_confidence = 0.9
      WHERE id = p_entry_id;
    ELSE
      v_errors := v_errors || jsonb_build_object(
        'code', 'FACILITY_NOT_FOUND',
        'message', format('Facility "%s" not found', v_entry.facility_name_raw),
        'field', 'facility_name_raw'
      );
    END IF;
  END IF;

  -- Check time validity
  IF v_entry.end_time <= v_entry.start_time THEN
    v_errors := v_errors || jsonb_build_object(
      'code', 'INVALID_TIME_RANGE',
      'message', 'End time must be after start time',
      'field', 'end_time'
    );
  END IF;

  -- Determine validation status
  IF jsonb_array_length(v_errors) > 0 THEN
    v_status := 'error';
  ELSIF jsonb_array_length(v_warnings) > 0 THEN
    v_status := 'warning';
  ELSE
    v_status := 'valid';
  END IF;

  -- Update validation status
  UPDATE public.schedule_entries_staging SET
    validation_errors = v_errors,
    validation_warnings = v_warnings,
    validation_status = v_status,
    updated_at = NOW()
  WHERE id = p_entry_id;

  RETURN jsonb_build_object('errors', v_errors, 'warnings', v_warnings, 'status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add manual entry
CREATE OR REPLACE FUNCTION public.add_manual_schedule_entry(
  p_upload_id UUID,
  p_facility_name VARCHAR,
  p_course_code VARCHAR,
  p_course_name VARCHAR,
  p_section VARCHAR,
  p_instructor_name VARCHAR,
  p_day_of_week SMALLINT,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_facility_id UUID;
BEGIN
  -- Try to match facility
  v_facility_id := public.find_facility_by_alias(p_facility_name);

  INSERT INTO public.schedule_entries_staging (
    schedule_upload_id, entry_source, facility_id, facility_name_raw,
    course_code, course_name, section, instructor_name,
    day_of_week, start_time, end_time
  ) VALUES (
    p_upload_id, 'manual_entry', v_facility_id, p_facility_name,
    p_course_code, p_course_name, p_section, p_instructor_name,
    p_day_of_week, p_start_time, p_end_time
  )
  RETURNING id INTO v_entry_id;

  -- Validate the new entry
  PERFORM public.validate_staging_entry(v_entry_id);

  -- Update upload counts
  PERFORM public.update_upload_counts(p_upload_id);

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update upload entry counts
CREATE OR REPLACE FUNCTION public.update_upload_counts(p_upload_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.schedule_uploads
  SET
    total_entries = (SELECT COUNT(*) FROM public.schedule_entries_staging WHERE schedule_upload_id = p_upload_id),
    valid_entries_count = (SELECT COUNT(*) FROM public.schedule_entries_staging WHERE schedule_upload_id = p_upload_id AND validation_status = 'valid'),
    warning_entries_count = (SELECT COUNT(*) FROM public.schedule_entries_staging WHERE schedule_upload_id = p_upload_id AND validation_status = 'warning'),
    error_entries_count = (SELECT COUNT(*) FROM public.schedule_entries_staging WHERE schedule_upload_id = p_upload_id AND validation_status = 'error'),
    conflict_count = (SELECT COUNT(*) FROM public.schedule_entries_staging WHERE schedule_upload_id = p_upload_id AND (has_internal_conflict OR has_external_conflict)),
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.schedule_entries_staging IS 'Draft schedule entries awaiting validation and approval';
COMMENT ON COLUMN public.schedule_entries_staging.facility_name_raw IS 'Original facility text from input for matching';
COMMENT ON COLUMN public.schedule_entries_staging.facility_match_confidence IS 'Confidence score 0.00-1.00 for facility matching';
COMMENT ON COLUMN public.schedule_entries_staging.validation_errors IS 'Array of error objects with code, message, field';
COMMENT ON COLUMN public.schedule_entries_staging.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON FUNCTION public.validate_staging_entry IS 'Validates a staging entry and updates its status';
COMMENT ON FUNCTION public.add_manual_schedule_entry IS 'Adds a manual schedule entry with auto-validation';
