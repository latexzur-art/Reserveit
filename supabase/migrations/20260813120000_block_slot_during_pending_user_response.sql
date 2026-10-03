-- Block slots during pending_user_response and cancellation_requested
-- Previously only ('pending', 'flagged', 'auto_approved', 'approved') blocked.
-- This caused double-booking when BA approved a requires_payment booking
-- (status → pending_user_response) — the slot appeared open to other clients.

-- 1. Update create_booking_transactional RPC
DROP FUNCTION IF EXISTS public.create_booking_transactional(
  UUID, UUID, public.booking_purpose, public.booking_type, DATE, TIME, TIME,
  UUID, TEXT, TEXT, INT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, BOOLEAN, JSONB, TEXT, UUID[]
);

DROP FUNCTION IF EXISTS public.create_booking_transactional CASCADE;

CREATE OR REPLACE FUNCTION public.create_booking_transactional(
  p_user_id UUID,
  p_facility_id UUID,
  p_booking_purpose public.booking_purpose,
  p_booking_type public.booking_type,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_time_slot_id UUID DEFAULT NULL,
  p_purpose TEXT DEFAULT '',
  p_event_name TEXT DEFAULT NULL,
  p_expected_attendees INT DEFAULT NULL,
  p_special_requests TEXT DEFAULT NULL,
  p_self_facilitation_confirmed BOOLEAN DEFAULT FALSE,
  p_facilitator_name TEXT DEFAULT NULL,
  p_facility_purpose_category TEXT DEFAULT NULL,
  p_mismatch_justification TEXT DEFAULT NULL,
  p_booking_course_code TEXT DEFAULT NULL,
  p_booking_department_code TEXT DEFAULT NULL,
  p_session_type TEXT DEFAULT NULL,
  p_organization_name TEXT DEFAULT NULL,
  p_contact_number TEXT DEFAULT NULL,
  p_requires_payment BOOLEAN DEFAULT FALSE,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_internal_notes TEXT DEFAULT NULL,
  p_equipment_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
  out_booking_id UUID,
  out_booking_reference TEXT,
  out_conflict_found BOOLEAN,
  out_conflict_reference TEXT,
  out_error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_booking_id UUID;
  v_booking_ref TEXT;
  v_dup_ref TEXT;
  v_overlap_ref TEXT;
  v_equip_id UUID;
BEGIN
  -- 1. Deduplication Pre-check (Active booking by same user at same slot)
  SELECT b.booking_reference INTO v_dup_ref
  FROM public.booking_facilities bf
  JOIN public.bookings b ON b.id = bf.booking_id
  WHERE bf.facility_id = p_facility_id
    AND b.user_id = p_user_id
    AND b.booking_date = p_booking_date
    AND b.start_time = p_start_time
    AND b.current_status IN ('pending', 'flagged', 'auto_approved', 'approved', 'pending_user_response', 'cancellation_requested')
  LIMIT 1;

  IF v_dup_ref IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, TRUE, v_dup_ref, 'You already have an active booking for this facility at the same date and time'::TEXT;
    RETURN;
  END IF;

  -- 2. Overlap Conflict Pre-check (Active booking by any user at overlapping slot)
  SELECT b.booking_reference INTO v_overlap_ref
  FROM public.booking_facilities bf
  JOIN public.bookings b ON b.id = bf.booking_id
  WHERE bf.facility_id = p_facility_id
    AND b.booking_date = p_booking_date
    AND b.current_status IN ('pending', 'flagged', 'auto_approved', 'approved', 'pending_user_response', 'cancellation_requested')
    AND b.start_time < p_end_time
    AND b.end_time > p_start_time
  LIMIT 1;

  IF v_overlap_ref IS NOT NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, TRUE, v_overlap_ref, 'Time slot already booked for this facility'::TEXT;
    RETURN;
  END IF;

  -- 3. Insert Parent Booking
  INSERT INTO public.bookings (
    user_id, booking_reference, booking_type, booking_purpose,
    booking_date, start_time, end_time, time_slot_id, purpose,
    event_name, expected_attendees, special_requests,
    self_facilitation_confirmed, facilitator_name, facility_purpose_category,
    mismatch_justification, booking_course_code, booking_department_code,
    session_type, organization_name, contact_number, current_status,
    requires_payment, metadata, internal_notes
  ) VALUES (
    p_user_id, '', p_booking_type, p_booking_purpose,
    p_booking_date, p_start_time, p_end_time, p_time_slot_id, p_purpose,
    p_event_name, p_expected_attendees, p_special_requests,
    p_self_facilitation_confirmed, p_facilitator_name, p_facility_purpose_category,
    p_mismatch_justification, p_booking_course_code, p_booking_department_code,
    p_session_type, p_organization_name, p_contact_number, 'pending',
    p_requires_payment, p_metadata, p_internal_notes
  )
  RETURNING public.bookings.id, public.bookings.booking_reference INTO v_booking_id, v_booking_ref;

  -- 4. Link Facility
  INSERT INTO public.booking_facilities (booking_id, facility_id)
  VALUES (v_booking_id, p_facility_id);

  -- 5. Link Equipment (if provided)
  IF p_equipment_ids IS NOT NULL AND array_length(p_equipment_ids, 1) > 0 THEN
    FOREACH v_equip_id IN ARRAY p_equipment_ids LOOP
      INSERT INTO public.booking_equipment (booking_id, equipment_id, quantity_requested)
      VALUES (v_booking_id, v_equip_id, 1);
    END LOOP;
  END IF;

  -- All writes successful; return new booking info
  RETURN QUERY SELECT v_booking_id, v_booking_ref, FALSE, NULL::TEXT, NULL::TEXT;
END;
$$;

-- Grant execution to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.create_booking_transactional TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_transactional TO service_role;

-- 2. Update check_booking_facility_overlap trigger function
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

  -- School event blocks are meant to override existing bookings
  IF v_booking_type = 'school_event_block' THEN
    RETURN NEW;
  END IF;

  -- Skip the check for terminal/inactive statuses. Only active bookings reserve capacity.
  IF v_current_status NOT IN ('pending', 'flagged', 'auto_approved', 'approved', 'pending_user_response', 'cancellation_requested') THEN
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
    AND b.current_status IN ('pending', 'flagged', 'auto_approved', 'approved', 'pending_user_response', 'cancellation_requested')
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
