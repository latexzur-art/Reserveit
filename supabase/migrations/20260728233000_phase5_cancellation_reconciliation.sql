-- =====================================================
-- Migration: Phase 5.3 — Cancellation Counter Reconciliation Function
-- Date: 2026-07-28
-- Description: Creates a function to reconcile users.consecutive_cancellations
--              against booking_status_history / bookings to eliminate drift.
-- =====================================================

CREATE OR REPLACE FUNCTION public.reconcile_consecutive_cancellations(
  p_user_id UUID DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_user record;
  v_count INT := 0;
  v_reconciled INT := 0;
BEGIN
  FOR v_user IN
    SELECT id
    FROM public.users
    WHERE (p_user_id IS NULL OR id = p_user_id)
  LOOP
    -- Count recent consecutive cancellations for the user
    WITH user_bookings AS (
      SELECT
        b.id,
        b.current_status,
        b.created_at,
        ROW_NUMBER() OVER (ORDER BY b.created_at DESC) AS rn
      FROM public.bookings b
      WHERE b.user_id = v_user.id
    ),
    consecutive_cancels AS (
      SELECT COUNT(*) AS cancel_count
      FROM user_bookings
      WHERE current_status = 'cancelled'
        AND rn <= (
          SELECT COALESCE(MIN(rn) - 1, (SELECT COUNT(*) FROM user_bookings))
          FROM user_bookings
          WHERE current_status != 'cancelled'
        )
    )
    SELECT COALESCE(cancel_count, 0) INTO v_count FROM consecutive_cancels;

    -- Update the user record
    UPDATE public.users
    SET consecutive_cancellations = v_count,
        updated_at = NOW()
    WHERE id = v_user.id
      AND consecutive_cancellations IS DISTINCT FROM v_count;

    IF FOUND THEN
      v_reconciled := v_reconciled + 1;
    END IF;
  END LOOP;

  RETURN v_reconciled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reconcile_consecutive_cancellations TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_consecutive_cancellations TO service_role;
