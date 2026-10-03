-- 1. Create financial_audit table
CREATE TABLE IF NOT EXISTS public.financial_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id),
    booking_id UUID NOT NULL REFERENCES public.bookings(id),
    amount DECIMAL(10, 2) NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create academic_timeline table
CREATE TABLE IF NOT EXISTS public.academic_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id),
    event_name TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    facility_id UUID NOT NULL REFERENCES public.facilities(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Trigger Function
CREATE OR REPLACE FUNCTION handle_payment_completed()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_date DATE;
    v_start_time TIME;
    v_end_time TIME;
    v_facility_id UUID;
    v_event_name TEXT;
BEGIN
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        -- 1. Financial Audit
        INSERT INTO public.financial_audit (payment_id, booking_id, amount, action)
        VALUES (NEW.id, NEW.booking_id, NEW.total_amount, 'PAYMENT_COMPLETED');

        -- 2. Update Reservations (Pending to Approved/Confirmed)
        UPDATE public.bookings
        SET current_status = 'approved',
            approved_at = NOW()
        WHERE id = NEW.booking_id AND current_status IN ('pending', 'flagged');

        -- Get booking details
        SELECT booking_date, start_time, end_time, COALESCE(event_name, purpose)
        INTO v_booking_date, v_start_time, v_end_time, v_event_name
        FROM public.bookings
        WHERE id = NEW.booking_id;

        -- Get facility id
        SELECT facility_id INTO v_facility_id
        FROM public.booking_facilities
        WHERE booking_id = NEW.booking_id
        LIMIT 1;

        -- 3. Academic Timeline
        IF v_facility_id IS NOT NULL THEN
            INSERT INTO public.academic_timeline (booking_id, event_name, start_time, end_time, facility_id)
            VALUES (
                NEW.booking_id,
                COALESCE(v_event_name, 'Paid Booking'),
                v_booking_date + v_start_time,
                v_booking_date + v_end_time,
                v_facility_id
            );

            -- 4. Facility Status to Unavailable/Reserved
            UPDATE public.facilities
            SET status = 'reserved'
            WHERE id = v_facility_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_completed ON public.payments;
CREATE TRIGGER trigger_payment_completed
    AFTER UPDATE OF payment_status ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION handle_payment_completed();