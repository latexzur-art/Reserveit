-- =====================================================
-- Fix: prevent_class_schedule_overlap false positives
-- =====================================================
-- When a schedule_uploads row is deleted, the FK
-- `schedule_upload_id ON DELETE SET NULL` causes
-- PostgreSQL to UPDATE every related class_schedules row
-- (setting schedule_upload_id = NULL). This cascade UPDATE
-- fires the conflict trigger, which then finds a
-- pre-existing overlap with another upload's schedule and
-- raises unique_violation — blocking the delete even though
-- no new conflict is being introduced.
--
-- Fix: skip the overlap check on UPDATE when none of the
-- scheduling-relevant fields (facility, day, time window,
-- active flag, supersession) actually changed.
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_class_schedule_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_conflict_course_code VARCHAR;
  v_conflict_section     VARCHAR;
  v_conflict_start       TIME;
  v_conflict_end         TIME;
BEGIN
  -- On UPDATE, skip the check when no scheduling-relevant field changed.
  -- This prevents false-positive conflicts during FK cascade updates
  -- (e.g. ON DELETE SET NULL nulling out schedule_upload_id).
  IF TG_OP = 'UPDATE' THEN
    IF OLD.facility_id    IS NOT DISTINCT FROM NEW.facility_id
      AND OLD.day_of_week   IS NOT DISTINCT FROM NEW.day_of_week
      AND OLD.start_time    IS NOT DISTINCT FROM NEW.start_time
      AND OLD.end_time      IS NOT DISTINCT FROM NEW.end_time
      AND OLD.is_active     IS NOT DISTINCT FROM NEW.is_active
      AND OLD.superseded_by IS NOT DISTINCT FROM NEW.superseded_by
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Only enforce for active, non-superseded schedules
  IF NEW.is_active = FALSE OR NEW.superseded_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Look for any overlapping active schedule on the same facility + day
  SELECT
    cs.course_code,
    cs.section,
    cs.start_time,
    cs.end_time
  INTO
    v_conflict_course_code,
    v_conflict_section,
    v_conflict_start,
    v_conflict_end
  FROM public.class_schedules cs
  WHERE cs.facility_id   = NEW.facility_id
    AND cs.day_of_week   = NEW.day_of_week
    AND cs.is_active     = TRUE
    AND cs.superseded_by IS NULL
    AND cs.id            != NEW.id        -- exclude self on UPDATE
    -- Overlap: intervals [a,b) and [c,d) overlap iff a < d AND b > c
    AND NEW.start_time   < cs.end_time
    AND NEW.end_time     > cs.start_time
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Class schedule conflict: % % (%–%) already occupies facility % on day % during %–%',
      v_conflict_course_code,
      v_conflict_section,
      v_conflict_start,
      v_conflict_end,
      NEW.facility_id,
      NEW.day_of_week,
      NEW.start_time,
      NEW.end_time
    USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.prevent_class_schedule_overlap() IS
  'Prevents overlapping class schedules for the same facility and day at the database level. '
  'Skips the check on UPDATEs that do not change any scheduling-relevant field (e.g. FK cascade nulls).';
