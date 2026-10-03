-- Atomic per-entry publish for the Academic Head direct-publish route.
-- Folds the previously-separate writes (deactivate overlapping schedules, insert
-- the new schedule, link superseded_by, flag the staging entry as published)
-- into a single plpgsql function. plpgsql runs in one implicit transaction, so a
-- crash can no longer leave a slot released without a replacement schedule.
-- Conflict selection, booking cancellation, and notifications stay in the route.
CREATE OR REPLACE FUNCTION public.publish_schedule_entry(
  p_entry_id        UUID,
  p_upload_id       UUID,
  p_conflict_ids    UUID[],
  p_effective_start DATE,
  p_effective_end   DATE,
  p_supersede_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  v_entry  RECORD;
  v_upload RECORD;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_entry  FROM public.schedule_entries_staging WHERE id = p_entry_id;
  SELECT * INTO v_upload FROM public.schedule_uploads         WHERE id = p_upload_id;

  -- Release overlapping slots first — the prevent_class_schedule_overlap trigger
  -- raises on any active overlap, so the insert below would fail otherwise.
  UPDATE public.class_schedules
     SET is_active = false, superseded_at = now(), supersede_reason = p_supersede_reason
   WHERE id = ANY(p_conflict_ids);

  INSERT INTO public.class_schedules (
    schedule_upload_id, staging_entry_id, academic_term_id, department_id,
    facility_id, course_code, course_name, session_type, section,
    instructor_id, instructor_name, day_of_week, start_time, end_time,
    effective_start_date, effective_end_date, is_active, version
  ) VALUES (
    p_upload_id, v_entry.id, v_upload.academic_term_id, v_upload.department_id,
    v_entry.facility_id, v_entry.course_code, v_entry.course_name, v_entry.session_type, v_entry.section,
    v_entry.instructor_id, v_entry.instructor_name, v_entry.day_of_week, v_entry.start_time, v_entry.end_time,
    p_effective_start, p_effective_end, true, 1
  )
  RETURNING id INTO v_new_id;

  UPDATE public.class_schedules     SET superseded_by = v_new_id WHERE id = ANY(p_conflict_ids);
  UPDATE public.schedule_entries_staging SET is_published = true WHERE id = p_entry_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
