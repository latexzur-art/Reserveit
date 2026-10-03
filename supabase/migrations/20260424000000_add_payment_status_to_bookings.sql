-- =====================================================
-- Add Payment Status to Bookings and Trigger
-- =====================================================
-- Description: 
--   1. Adds payment_status column to public.bookings
--   2. Adds a trigger to set payment_status to 'pending' when a booking is approved
-- Date: 2026-04-24
-- =====================================================

-- 1. Ensure the payment_status type exists (it should from payments table migration)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    END IF;
END $$;

-- 2. Add payment_status column to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS payment_status public.payment_status DEFAULT NULL;

-- 3. Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.handle_booking_approval_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when current_status changes to 'approved'
    -- And only if it was not already 'approved'
    IF NEW.current_status = 'approved' AND (OLD.current_status IS NULL OR OLD.current_status != 'approved') THEN
        -- Check if payment is required (either external_paid or requires_payment is true)
        -- This ensures internal_free bookings don't get a pending payment status
        IF NEW.booking_type = 'external_paid' OR NEW.requires_payment = true THEN
            NEW.payment_status := 'pending'::public.payment_status;
        END IF;
    END IF;

    -- If the booking status is changed back from approved to something else, 
    -- we might want to reset payment_status if it hasn't been paid yet?
    -- For now, let's just stick to the requested logic.
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trigger_handle_booking_approval_payment_status ON public.bookings;
CREATE TRIGGER trigger_handle_booking_approval_payment_status
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_booking_approval_payment_status();

-- 5. Add comment
COMMENT ON COLUMN public.bookings.payment_status IS 'Payment status for external/paid bookings. Set to pending on approval.';
