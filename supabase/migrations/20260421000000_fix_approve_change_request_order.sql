-- Fix approve_change_request to deactivate original schedule before inserting new one
-- to prevent false-positive trigger conflict errors

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
        supersede_reason = COALESCE(v_request.reason, 'Cancelled via change request'),
        updated_at = NOW()
    WHERE id = v_request.original_schedule_id;

  ELSIF v_request.change_type = 'modify' THEN
    -- Get original schedule
    SELECT * INTO v_original FROM public.class_schedules WHERE id = v_request.original_schedule_id;

    -- Deactivate original first to prevent trigger conflict when inserting new
    UPDATE public.class_schedules
    SET is_active = FALSE,
        superseded_at = NOW(),
        supersede_reason = COALESCE(v_request.reason, 'Modified via change request'),
        updated_at = NOW()
    WHERE id = v_request.original_schedule_id;

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
      COALESCE(v_original.version, 1) + 1
    )
    RETURNING id INTO v_new_schedule_id;

    -- Update original with superseded_by reference
    UPDATE public.class_schedules
    SET superseded_by = v_new_schedule_id
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
