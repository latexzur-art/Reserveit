-- Atomic apply of an academic-head proposal accepted by faculty.
-- Replaces two non-atomic UPDATEs in app/api/academic-head/respond-proposal/route.ts
-- so that booking_date/start_time/end_time and the booking_facilities row swap
-- happen under a single row-level lock and cannot interleave with concurrent writes.

CREATE OR REPLACE FUNCTION apply_booking_proposal(
  p_booking_id UUID,
  p_new_date DATE,
  p_new_start TIME,
  p_new_end TIME,
  p_old_facility_id UUID,
  p_new_facility_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_booking RECORD;
BEGIN
  -- Acquire a row-level lock on the booking so any concurrent proposal/approval
  -- waits until we finish.
  SELECT id INTO v_locked_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- Apply date/time changes if provided
  IF p_new_date IS NOT NULL OR p_new_start IS NOT NULL OR p_new_end IS NOT NULL THEN
    UPDATE bookings
    SET
      booking_date = COALESCE(p_new_date, booking_date),
      start_time = COALESCE(p_new_start, start_time),
      end_time = COALESCE(p_new_end, end_time),
      updated_at = NOW()
    WHERE id = p_booking_id;
  END IF;

  -- Swap facility if the proposal includes one
  IF p_new_facility_id IS NOT NULL AND p_old_facility_id IS NOT NULL THEN
    UPDATE booking_facilities
    SET facility_id = p_new_facility_id
    WHERE booking_id = p_booking_id
      AND facility_id = p_old_facility_id;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_booking_proposal(UUID, DATE, TIME, TIME, UUID, UUID) TO authenticated, service_role;
