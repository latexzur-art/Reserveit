-- =====================================================
-- Phase 1.2: Create Schedule Change Requests Table
-- =====================================================
-- Description: Mid-semester modification workflow for class schedules
-- Date: 2026-02-02
-- =====================================================

-- Create change_type enum
DO $$ BEGIN
  CREATE TYPE change_type AS ENUM ('modify', 'cancel', 'add');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create change_request_status enum
DO $$ BEGIN
  CREATE TYPE change_request_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create schedule_change_requests table
CREATE TABLE IF NOT EXISTS public.schedule_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being changed
  original_schedule_id UUID REFERENCES public.class_schedules(id) ON DELETE RESTRICT,
  change_type change_type NOT NULL,

  -- Who's requesting
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,

  -- New values (for 'modify' and 'add')
  new_facility_id UUID REFERENCES public.facilities(id) ON DELETE RESTRICT,
  new_course_code VARCHAR(50),
  new_course_name VARCHAR(255),
  new_section VARCHAR(50),
  new_instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  new_instructor_name VARCHAR(255),
  new_day_of_week SMALLINT CHECK (new_day_of_week IS NULL OR new_day_of_week BETWEEN 0 AND 6),
  new_start_time TIME,
  new_end_time TIME,
  new_effective_start_date DATE,
  new_effective_end_date DATE,

  -- Reason (required)
  reason TEXT NOT NULL,

  -- Conflict check results
  affects_bookings BOOLEAN DEFAULT FALSE,
  affected_booking_ids UUID[] DEFAULT '{}',
  conflict_details JSONB,

  -- Status
  status change_request_status DEFAULT 'draft',

  -- Approval tracking
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,

  -- Result
  resulting_schedule_id UUID REFERENCES public.class_schedules(id) ON DELETE SET NULL,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT change_type_requirements CHECK (
    (change_type = 'cancel' AND original_schedule_id IS NOT NULL) OR
    (change_type = 'modify' AND original_schedule_id IS NOT NULL) OR
    (change_type = 'add' AND original_schedule_id IS NULL)
  ),
  CONSTRAINT valid_new_time CHECK (
    new_end_time IS NULL OR new_start_time IS NULL OR new_end_time > new_start_time
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS change_requests_original_idx ON public.schedule_change_requests(original_schedule_id);
CREATE INDEX IF NOT EXISTS change_requests_status_idx ON public.schedule_change_requests(status);
CREATE INDEX IF NOT EXISTS change_requests_requester_idx ON public.schedule_change_requests(requested_by);
CREATE INDEX IF NOT EXISTS change_requests_dept_idx ON public.schedule_change_requests(department_id);
CREATE INDEX IF NOT EXISTS change_requests_created_at_idx ON public.schedule_change_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.schedule_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own requests
CREATE POLICY "Users can view own change requests"
  ON public.schedule_change_requests FOR SELECT
  USING (requested_by = auth.uid());

-- Users can create change requests
CREATE POLICY "Users can create change requests"
  ON public.schedule_change_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

-- Users can update their own draft requests
CREATE POLICY "Users can update own draft requests"
  ON public.schedule_change_requests FOR UPDATE
  USING (requested_by = auth.uid() AND status = 'draft')
  WITH CHECK (requested_by = auth.uid());

-- Users can delete their own draft requests
CREATE POLICY "Users can delete own draft requests"
  ON public.schedule_change_requests FOR DELETE
  USING (requested_by = auth.uid() AND status = 'draft');

-- Service role has full access
CREATE POLICY "Service role can manage change requests"
  ON public.schedule_change_requests FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_change_requests_updated_at
  BEFORE UPDATE ON public.schedule_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create a schedule change request
CREATE OR REPLACE FUNCTION public.create_schedule_change_request(
  p_original_schedule_id UUID,
  p_change_type change_type,
  p_requested_by UUID,
  p_reason TEXT,
  p_new_facility_id UUID DEFAULT NULL,
  p_new_course_code VARCHAR DEFAULT NULL,
  p_new_course_name VARCHAR DEFAULT NULL,
  p_new_section VARCHAR DEFAULT NULL,
  p_new_instructor_name VARCHAR DEFAULT NULL,
  p_new_day_of_week SMALLINT DEFAULT NULL,
  p_new_start_time TIME DEFAULT NULL,
  p_new_end_time TIME DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
  v_department_id UUID;
  v_original RECORD;
BEGIN
  -- Get department from original schedule or requester
  IF p_original_schedule_id IS NOT NULL THEN
    SELECT department_id INTO v_department_id
    FROM public.class_schedules
    WHERE id = p_original_schedule_id;
  ELSE
    -- For 'add' type, get department from user
    SELECT department_id INTO v_department_id
    FROM public.users
    WHERE id = p_requested_by;
  END IF;

  INSERT INTO public.schedule_change_requests (
    original_schedule_id, change_type, requested_by, department_id, reason,
    new_facility_id, new_course_code, new_course_name, new_section,
    new_instructor_name, new_day_of_week, new_start_time, new_end_time
  ) VALUES (
    p_original_schedule_id, p_change_type, p_requested_by, v_department_id, p_reason,
    p_new_facility_id, p_new_course_code, p_new_course_name, p_new_section,
    p_new_instructor_name, p_new_day_of_week, p_new_start_time, p_new_end_time
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check affected bookings for a change request
CREATE OR REPLACE FUNCTION public.check_affected_bookings(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
  v_original RECORD;
  v_affected_ids UUID[];
  v_booking RECORD;
  v_new_day INT;
  v_new_start TIME;
  v_new_end TIME;
BEGIN
  SELECT * INTO v_request FROM public.schedule_change_requests WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- Get original schedule details
  IF v_request.original_schedule_id IS NOT NULL THEN
    SELECT * INTO v_original FROM public.class_schedules WHERE id = v_request.original_schedule_id;
  END IF;

  -- Determine the new schedule parameters
  v_new_day := COALESCE(v_request.new_day_of_week, v_original.day_of_week);
  v_new_start := COALESCE(v_request.new_start_time, v_original.start_time);
  v_new_end := COALESCE(v_request.new_end_time, v_original.end_time);

  -- Find bookings that would conflict with the NEW schedule
  IF v_request.change_type = 'modify' AND v_request.new_facility_id IS NOT NULL THEN
    SELECT ARRAY_AGG(b.id) INTO v_affected_ids
    FROM public.bookings b
    JOIN public.booking_facilities bf ON b.id = bf.booking_id
    WHERE bf.facility_id = v_request.new_facility_id
      AND EXTRACT(DOW FROM b.booking_date) = v_new_day
      AND b.current_status IN ('pending', 'approved')
      AND (
        (b.start_time >= v_new_start AND b.start_time < v_new_end) OR
        (b.end_time > v_new_start AND b.end_time <= v_new_end) OR
        (b.start_time <= v_new_start AND b.end_time >= v_new_end)
      );
  END IF;

  -- Update the request with affected bookings
  UPDATE public.schedule_change_requests
  SET affects_bookings = (v_affected_ids IS NOT NULL AND array_length(v_affected_ids, 1) > 0),
      affected_booking_ids = COALESCE(v_affected_ids, '{}'),
      updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'affected_count', COALESCE(array_length(v_affected_ids, 1), 0),
    'affected_booking_ids', COALESCE(v_affected_ids, '{}')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit change request for review
CREATE OR REPLACE FUNCTION public.submit_change_request(p_request_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check affected bookings first
  PERFORM public.check_affected_bookings(p_request_id);

  UPDATE public.schedule_change_requests
  SET status = 'pending',
      updated_at = NOW()
  WHERE id = p_request_id
    AND status = 'draft';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve change request
CREATE OR REPLACE FUNCTION public.approve_change_request(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
  v_original RECORD;
  v_new_schedule_id UUID;
  v_term_id UUID;
BEGIN
  SELECT * INTO v_request FROM public.schedule_change_requests WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request must be in pending status');
  END IF;

  -- Handle based on change type
  IF v_request.change_type = 'cancel' THEN
    -- Mark original schedule as superseded
    UPDATE public.class_schedules
    SET is_active = FALSE,
        superseded_at = NOW(),
        supersede_reason = v_request.reason,
        updated_at = NOW()
    WHERE id = v_request.original_schedule_id;

  ELSIF v_request.change_type = 'modify' THEN
    -- Get original schedule
    SELECT * INTO v_original FROM public.class_schedules WHERE id = v_request.original_schedule_id;

    -- Create new version
    INSERT INTO public.class_schedules (
      schedule_upload_id, academic_term_id, department_id,
      facility_id, course_code, course_name, section,
      instructor_id, instructor_name, day_of_week, start_time, end_time,
      effective_start_date, effective_end_date, version
    ) VALUES (
      v_original.schedule_upload_id,
      v_original.academic_term_id,
      v_original.department_id,
      COALESCE(v_request.new_facility_id, v_original.facility_id),
      COALESCE(v_request.new_course_code, v_original.course_code),
      COALESCE(v_request.new_course_name, v_original.course_name),
      COALESCE(v_request.new_section, v_original.section),
      COALESCE(v_request.new_instructor_id, v_original.instructor_id),
      COALESCE(v_request.new_instructor_name, v_original.instructor_name),
      COALESCE(v_request.new_day_of_week, v_original.day_of_week),
      COALESCE(v_request.new_start_time, v_original.start_time),
      COALESCE(v_request.new_end_time, v_original.end_time),
      COALESCE(v_request.new_effective_start_date, v_original.effective_start_date),
      COALESCE(v_request.new_effective_end_date, v_original.effective_end_date),
      v_original.version + 1
    )
    RETURNING id INTO v_new_schedule_id;

    -- Mark original as superseded
    UPDATE public.class_schedules
    SET is_active = FALSE,
        superseded_by = v_new_schedule_id,
        superseded_at = NOW(),
        supersede_reason = v_request.reason,
        updated_at = NOW()
    WHERE id = v_request.original_schedule_id;

  ELSIF v_request.change_type = 'add' THEN
    -- Get active term
    SELECT id INTO v_term_id FROM public.academic_terms WHERE is_active = TRUE LIMIT 1;

    -- Create new schedule
    INSERT INTO public.class_schedules (
      academic_term_id, department_id,
      facility_id, course_code, course_name, section,
      instructor_id, instructor_name, day_of_week, start_time, end_time,
      effective_start_date, effective_end_date
    ) VALUES (
      v_term_id,
      v_request.department_id,
      v_request.new_facility_id,
      v_request.new_course_code,
      v_request.new_course_name,
      v_request.new_section,
      v_request.new_instructor_id,
      v_request.new_instructor_name,
      v_request.new_day_of_week,
      v_request.new_start_time,
      v_request.new_end_time,
      COALESCE(v_request.new_effective_start_date, (SELECT start_date FROM public.academic_terms WHERE id = v_term_id)),
      COALESCE(v_request.new_effective_end_date, (SELECT end_date FROM public.academic_terms WHERE id = v_term_id))
    )
    RETURNING id INTO v_new_schedule_id;
  END IF;

  -- Update request status
  UPDATE public.schedule_change_requests
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      review_notes = p_notes,
      resulting_schedule_id = v_new_schedule_id,
      updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'change_type', v_request.change_type,
    'new_schedule_id', v_new_schedule_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject change request
CREATE OR REPLACE FUNCTION public.reject_change_request(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.schedule_change_requests
  SET status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      review_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_request_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.schedule_change_requests IS 'Mid-semester modification requests for class schedules';
COMMENT ON COLUMN public.schedule_change_requests.change_type IS 'modify=change existing, cancel=remove, add=new schedule';
COMMENT ON COLUMN public.schedule_change_requests.affects_bookings IS 'True if change would affect existing bookings';
COMMENT ON COLUMN public.schedule_change_requests.resulting_schedule_id IS 'New schedule created after approval (for modify/add)';
COMMENT ON FUNCTION public.create_schedule_change_request IS 'Creates a new schedule change request';
COMMENT ON FUNCTION public.check_affected_bookings IS 'Checks which bookings would be affected by a change';
COMMENT ON FUNCTION public.approve_change_request IS 'Approves request and applies the schedule change';
COMMENT ON FUNCTION public.reject_change_request IS 'Rejects a change request with notes';
