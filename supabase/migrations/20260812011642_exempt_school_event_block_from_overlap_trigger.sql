-- The booking-facility overlap trigger (20260508000000_add_booking_overlap_lock_trigger.sql)
-- exists to stop two normal reservations from double-booking the same facility/date/time.
-- It has no exemption for booking_type='school_event_block' -- discovered live during Phase 7
-- verification of the School Events + Exam Period Block feature: a school event block is
-- deliberately meant to be created OVER an already-active conflicting booking (that's the whole
-- point -- applySchoolEventBlock then displaces/offers-reschedule to whatever it conflicts with),
-- but the trigger unconditionally rejected that insert with a 23P01 exclusion violation. This
-- silently broke the feature's core promise -- both the pre-existing School Events flow and this
-- one -- whenever a real conflict existed, not just newly-introduced behavior.
--
-- Fix: skip the overlap check entirely when the booking being inserted is itself a
-- school_event_block. Normal-vs-normal double-booking protection is unchanged.
CREATE OR REPLACE FUNCTION public.check_booking_facility_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_date DATE;
  v_start_time TIME;
  v_end_time TIME;
  v_current_status booking_status;
  v_booking_type booking_type;
  v_conflict_ref TEXT;
BEGIN
  SELECT booking_date, start_time, end_time, current_status, booking_type
    INTO v_booking_date, v_start_time, v_end_time, v_current_status, v_booking_type
  FROM public.bookings
  WHERE id = NEW.booking_id;

  -- School event blocks are meant to override existing bookings -- applySchoolEventBlock
  -- displaces/offers-reschedule to whatever they conflict with, after this insert succeeds.
  IF v_booking_type = 'school_event_block' THEN
    RETURN NEW;
  END IF;

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
