-- =====================================================
-- Auto-complete past approved bookings
-- =====================================================
-- Description: Function to mark approved/auto_approved bookings as
--   completed when their booking_date has passed. Called from API routes
--   on each request so no cron job is needed.
-- Date: 2026-03-05
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_complete_past_bookings(
  p_user_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_booking RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_booking IN
    SELECT id, current_status
    FROM public.bookings
    WHERE current_status IN ('approved', 'auto_approved')
      AND booking_date < CURRENT_DATE
      AND (p_user_id IS NULL OR user_id = p_user_id)
  LOOP
    -- Insert history record
    INSERT INTO public.booking_status_history (
      booking_id,
      previous_status,
      new_status,
      changed_by_ai,
      reason
    ) VALUES (
      v_booking.id,
      v_booking.current_status,
      'completed',
      true,
      'Auto-completed: booking date has passed'
    );

    -- Update booking
    UPDATE public.bookings
    SET current_status = 'completed',
        completed_at   = NOW(),
        updated_at     = NOW()
    WHERE id = v_booking.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow authenticated users to invoke this function
GRANT EXECUTE ON FUNCTION public.auto_complete_past_bookings(UUID) TO authenticated;
