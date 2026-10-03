-- ============================================================
-- Emergency Reschedule Requests: Partial Unique Index
-- ============================================================
-- Description: Deferred from 20260521020000 — enum value 'pending_extra_payment'
--              cannot be used in a partial index WHERE clause in the same
--              transaction it is added (PostgreSQL restriction).
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reschedule_requests_one_active_per_booking
  ON public.emergency_reschedule_requests(booking_id)
  WHERE status IN ('pending', 'pending_extra_payment');
