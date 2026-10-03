-- =====================================================
-- Fix: Booking Reference Generation Race Condition
-- =====================================================
-- The original generate_booking_reference() uses COUNT(*)+1 inside a BEFORE
-- INSERT trigger.  Under concurrent inserts two transactions can read the same
-- count before either commits, producing duplicate sequence numbers that then
-- violate the UNIQUE constraint on booking_reference and surface as 500 errors.
--
-- Fix: wrap the count+assign with pg_advisory_xact_lock() keyed on the
-- current calendar date.  The lock is transaction-scoped, so it is released
-- automatically on commit or rollback — no manual cleanup required.
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  sequence_num INTEGER;
  new_reference TEXT;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Acquire an exclusive advisory lock scoped to this transaction.
  -- Only one transaction at a time can hold this lock for a given day,
  -- so the COUNT(*) read and the INSERT that follows are effectively serialised.
  PERFORM pg_advisory_xact_lock(hashtext('booking_ref_' || today_date));

  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.bookings
  WHERE DATE(created_at) = CURRENT_DATE;

  new_reference := 'BK-' || today_date || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;
