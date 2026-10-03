-- =====================================================
-- Booking Pipeline Partial Indexes
-- =====================================================
-- Description: Deferred from 20260219010100 because PostgreSQL does not allow
--              newly-added enum values to be used in partial index WHERE clauses
--              within the same transaction they are added. Running in a separate
--              migration ensures the enum values are committed first.
-- Date: 2026-02-19
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bookings_oversight_active
  ON public.bookings(oversight_expires_at)
  WHERE current_status IN ('auto_approved', 'flagged');

CREATE INDEX IF NOT EXISTS idx_bookings_conflict_check
  ON public.bookings(booking_date, start_time, end_time)
  WHERE current_status IN ('approved', 'auto_approved', 'flagged', 'pending');
