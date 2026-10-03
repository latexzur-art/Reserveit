-- =====================================================
-- Awaiting-Reschedule Partial Index (deferred)
-- =====================================================
-- Deferred from 20260523160800 — 'awaiting_reschedule' cannot be used in a
-- partial index WHERE clause within the same transaction it is added.
-- =====================================================

CREATE INDEX IF NOT EXISTS bookings_reschedule_deadline_idx
  ON public.bookings (reschedule_deadline)
  WHERE current_status = 'awaiting_reschedule';
