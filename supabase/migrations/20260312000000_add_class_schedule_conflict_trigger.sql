-- =====================================================
-- Add conflict prevention trigger on class_schedules
-- =====================================================
-- Prevents overlapping class schedules for the same
-- facility and day of week at the DB level.
-- Complements the application-layer conflict detection
-- done during staging validation (conflictDetector.ts).
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_class_schedule_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_conflict_course_code VARCHAR;
  v_conflict_section     VARCHAR;
  v_conflict_start       TIME;
  v_conflict_end         TIME;
BEGIN
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

DROP TRIGGER IF EXISTS trg_prevent_class_schedule_overlap ON public.class_schedules;

CREATE TRIGGER trg_prevent_class_schedule_overlap
  BEFORE INSERT OR UPDATE ON public.class_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_class_schedule_overlap();

COMMENT ON FUNCTION public.prevent_class_schedule_overlap() IS
  'Prevents overlapping class schedules for the same facility and day at the database level.';

COMMENT ON TRIGGER trg_prevent_class_schedule_overlap ON public.class_schedules IS
  'Enforces no two active, non-superseded class schedules overlap in time for the same facility+day.';
