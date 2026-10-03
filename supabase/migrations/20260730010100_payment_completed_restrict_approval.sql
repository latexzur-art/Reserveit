-- Restrict the payment-completed trigger's booking approval to the ONLY legitimate
-- source state. A paid booking must be approved by a building admin FIRST (which sets
-- current_status='pending_user_response'); payment then officially books it. Approving
-- from 'pending' or 'flagged' would skip building-admin review entirely, so those are
-- removed from the trigger's WHERE clause. This trigger is now the SOLE writer of this
-- transition — the redundant duplicate writes in the app-code PayMongo handlers are
-- removed in the same change (see app/api/paymongo/*, backend/booking/paymentNotifier.ts).

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

        -- 2. Officially book: ONLY from pending_user_response (building-admin already
        -- approved, awaiting payment). pending/flagged are the admin's own review queue
        -- and must never be auto-approved by a payment.
        UPDATE public.bookings
        SET current_status = 'approved',
            approved_at = NOW()
        WHERE id = NEW.booking_id AND current_status = 'pending_user_response';

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

        -- 3. Academic Timeline + 4. Facility Status
        IF v_facility_id IS NOT NULL THEN
            INSERT INTO public.academic_timeline (booking_id, event_name, start_time, end_time, facility_id)
            VALUES (
                NEW.booking_id,
                COALESCE(v_event_name, 'Paid Booking'),
                v_booking_date + v_start_time,
                v_booking_date + v_end_time,
                v_facility_id
            );

            UPDATE public.facilities
            SET status = 'reserved'
            WHERE id = v_facility_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
