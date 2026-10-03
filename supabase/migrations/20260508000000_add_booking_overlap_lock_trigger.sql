-- =====================================================
-- Fix: Race Condition on Concurrent Booking Creation (P0-1)
-- =====================================================
-- The route does an app-level conflict check then inserts. Two concurrent
-- requests for the same facility/date/time can both pass the check and both
-- insert, leaving duplicate active bookings. Postgres EXCLUDE constraints
-- can't span tables, so we use an advisory lock keyed on (facility_id,
-- booking_date) inside a BEFORE INSERT trigger on booking_facilities.
--
-- The lock is transaction-scoped, so concurrent inserts for the same slot
-- serialize. The trigger then re-checks for overlap and raises an
-- exclusion_violation (23P01) if a conflicting active booking exists.
-- The route maps that error code to a 409 and cleans up the orphan booking.
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_booking_facility_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_date DATE;
  v_start_time TIME;
  v_end_time TIME;
  v_current_status booking_status;
  v_conflict_ref TEXT;
BEGIN
  SELECT booking_date, start_time, end_time, current_status
    INTO v_booking_date, v_start_time, v_end_time, v_current_status
  FROM public.bookings
  WHERE id = NEW.booking_id;

  -- Skip the check for terminal/inactive statuses (cancelled, rejected,
  -- completed, auto_declined). Only active bookings reserve capacity.
  IF v_current_status NOT IN ('pending', 'flagged', 'auto_approved', 'approved') THEN
    RETURN NEW;
  END IF;

  -- Serialize on (facility, date). Released automatically at txn end.
  PERFORM pg_advisory_xact_lock(
    hashtext('booking_slot:' || NEW.facility_id::text || ':' || v_booking_date::text)
  );

  SELECT b.booking_reference INTO v_conflict_ref
  FROM public.bookings b
  JOIN public.booking_facilities bf ON bf.booking_id = b.id
  WHERE bf.facility_id = NEW.facility_id
    AND b.booking_date = v_booking_date
    AND b.id <> NEW.booking_id
    AND b.current_status IN ('pending', 'flagged', 'auto_approved', 'approved')
    AND b.start_time < v_end_time
    AND b.end_time > v_start_time
  LIMIT 1;

  IF v_conflict_ref IS NOT NULL THEN
    RAISE EXCEPTION 'Time slot already booked for this facility (conflict with %)', v_conflict_ref
      USING ERRCODE = '23P01',
            DETAIL = 'facility_id=' || NEW.facility_id
                  || ' date=' || v_booking_date
                  || ' time=' || v_start_time || '-' || v_end_time
                  || ' conflicting_booking_reference=' || v_conflict_ref;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_booking_facility_overlap ON public.booking_facilities;
CREATE TRIGGER trigger_check_booking_facility_overlap
  BEFORE INSERT ON public.booking_facilities
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_facility_overlap();

COMMENT ON FUNCTION public.check_booking_facility_overlap IS
  'Serializes concurrent booking_facilities inserts on (facility_id, booking_date) '
  'via advisory lock and re-checks for time-window overlap to prevent the race '
  'condition where two users both pass the app-level conflict check.';
