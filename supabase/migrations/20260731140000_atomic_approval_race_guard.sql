-- =====================================================
-- F4 — Atomic post-decision race guard
-- =====================================================
-- Supports plans/booking-pipeline-decision-time-audit.md Phase 4, F4.
--
-- Problem (verified in the audit): bookingPipeline.ts's post-decision race guard
-- re-checks for conflicts AFTER makeDecision() has already committed
-- current_status='approved'/'auto_approved', using a plain SELECT-then-maybe-UPDATE.
-- That SELECT is not atomic relative to a concurrent booking's own race-guard SELECT
-- for the same facility+slot — two nearly-simultaneous approvals can each see "no
-- conflict yet" (neither has finished writing) and both stay approved, or under other
-- timings neither survives. The guard's status set was also narrower
-- (['approved','auto_approved']) than the hard-check's and the insert-time RPC's
-- (['approved','auto_approved','flagged','pending']) — three inconsistent gates
-- guarding the same invariant.
--
-- Fix: a single Postgres function that (a) takes a transaction-scoped advisory lock
-- keyed on (facility_id, booking_date) so only one caller can be evaluating+deciding
-- a given facility's day at a time, (b) reconciles the status set with the other two
-- gates, and (c) breaks ties deterministically by created_at (the earlier booking
-- always wins) instead of leaving the outcome to whichever transaction's SELECT
-- happened to run first — closing both race directions the audit called out.
--
-- This is intentionally NOT a DB-level EXCLUDE constraint: bookings do not have a
-- single facility_id column (that lives in booking_facilities, modeled many-to-many
-- even though the app only ever attaches one facility per booking today), and adding
-- a hard constraint without being able to verify the live table has zero pre-existing
-- overlaps first would risk the migration itself failing on deploy. This function is
-- purely additive and safe to run regardless of existing data.
-- =====================================================

CREATE OR REPLACE FUNCTION public.finalize_booking_approval(
  p_booking_id uuid,
  p_facility_id uuid,
  p_booking_date date,
  p_start_time time,
  p_end_time time
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_this_created_at timestamptz;
  v_conflict_exists boolean;
BEGIN
  -- Serialize all concurrent finalize calls for this facility+date. Released
  -- automatically at transaction end (commit or rollback) — no manual unlock needed.
  PERFORM pg_advisory_xact_lock(hashtext(p_facility_id::text || p_booking_date::text));

  SELECT created_at INTO v_this_created_at FROM public.bookings WHERE id = p_booking_id;

  -- Reconciled status set (matches hard-check's checkBookingConflict and the
  -- create_booking_transactional RPC pre-check) + first-created-wins tiebreak: only
  -- a STRICTLY EARLIER booking counts as a real conflict, so of two bookings that
  -- both ended up approved for the same overlapping slot, the one submitted first
  -- deterministically wins regardless of which transaction's check happens to run
  -- first under the lock.
  SELECT EXISTS (
    SELECT 1
    FROM public.booking_facilities bf
    JOIN public.bookings b ON b.id = bf.booking_id
    WHERE bf.facility_id = p_facility_id
      AND b.booking_date = p_booking_date
      AND b.current_status IN ('approved', 'auto_approved', 'flagged', 'pending')
      AND b.id != p_booking_id
      AND b.created_at < v_this_created_at
      AND b.start_time < p_end_time
      AND b.end_time > p_start_time
  ) INTO v_conflict_exists;

  RETURN NOT v_conflict_exists;
END;
$$;

COMMENT ON FUNCTION public.finalize_booking_approval IS
  'F4: atomic (advisory-lock-serialized), first-created-wins conflict check used by bookingPipeline.ts post-decision race guard. Returns true if the booking should stay approved, false if it lost the race and must be rolled back to auto_declined.';

REVOKE ALL ON FUNCTION public.finalize_booking_approval FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_booking_approval TO service_role;
