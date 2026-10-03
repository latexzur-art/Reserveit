-- =====================================================
-- Handle Facility Block Overrides
-- =====================================================
-- Description: 
--   1. Trigger to automatically cancel or flag conflicting 
--      bookings when a facility block (Global Event) is added.
-- Date: 2026-04-24
-- =====================================================

-- 1. Create the override function
CREATE OR REPLACE FUNCTION public.handle_facility_block_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    affected_booking_record RECORD;
BEGIN
    -- Find all bookings that overlap with the new block
    -- Only affect active/pending bookings
    FOR affected_booking_record IN
        SELECT b.id, b.booking_reference, b.current_status, b.user_id
        FROM public.bookings b
        JOIN public.booking_facilities bf ON b.id = bf.booking_id
        WHERE bf.facility_id = NEW.facility_id
          AND b.booking_date = NEW.start_time::DATE
          AND b.current_status IN ('pending', 'approved', 'auto_approved', 'flagged')
          -- Check time overlap
          AND b.start_time < NEW.end_time::TIME
          AND b.end_time > NEW.start_time::TIME
    LOOP
        -- Update the booking status to 'cancelled'
        -- Use update_booking_status RPC logic or direct update
        UPDATE public.bookings
        SET current_status = 'cancelled',
            updated_at = NOW()
        WHERE id = affected_booking_record.id;

        -- Log to history
        INSERT INTO public.booking_status_history (
            booking_id,
            previous_status,
            new_status,
            reason,
            metadata
        ) VALUES (
            affected_booking_record.id,
            affected_booking_record.current_status,
            'cancelled',
            'System Override: Conflict with Global Event (' || NEW.reason || ')',
            jsonb_build_object(
                'block_id', NEW.id,
                'block_type', NEW.block_type,
                'override_type', 'admin_global_event'
            )
        );

        -- Note: Actual notification sending should ideally happen via a separate trigger 
        -- or application logic watching for status changes to 'cancelled'.
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trigger_handle_facility_block_conflicts ON public.facility_blocks;
CREATE TRIGGER trigger_handle_facility_block_conflicts
    AFTER INSERT ON public.facility_blocks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_facility_block_conflicts();

-- 3. Function to detect conflicts between reservations and schedules (Manual Check)
-- This can be called by the Program Head or Academic Head
CREATE OR REPLACE FUNCTION public.detect_reservation_schedule_conflicts(p_date DATE)
RETURNS TABLE (
    booking_id UUID,
    booking_ref TEXT,
    schedule_id UUID,
    course_code TEXT,
    facility_id UUID,
    conflict_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id AS booking_id,
        b.booking_reference AS booking_ref,
        cs.id AS schedule_id,
        cs.course_code,
        bf.facility_id,
        'class_schedule'::TEXT AS conflict_type
    FROM public.bookings b
    JOIN public.booking_facilities bf ON b.id = bf.booking_id
    JOIN public.class_schedules cs ON bf.facility_id = cs.facility_id
    WHERE b.booking_date = p_date
      AND cs.is_active = true
      AND cs.day_of_week = EXTRACT(DOW FROM p_date)
      AND b.current_status IN ('pending', 'approved', 'auto_approved')
      -- Time overlap
      AND b.start_time < cs.end_time
      AND b.end_time > cs.start_time;
END;
$$ LANGUAGE plpgsql;
