-- Track whether the auto-decision pipeline has claimed/processed a booking.
--
-- Purpose:
--   1. Idempotency — processBooking atomically claims this column so a booking
--      can never be double-processed (server after() + cron sweeper + manual retry).
--   2. Orphan detection — the sweeper finds auto-path bookings that are stuck
--      'pending' with pipeline_processed_at IS NULL (i.e. the pipeline never ran,
--      e.g. the browser tab closed before the fire-and-forget landed).
--
-- A non-null value means "the pipeline has run for this booking" regardless of the
-- outcome (auto_approved / auto_declined / flagged / routed-to-manual).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pipeline_processed_at timestamptz;

-- Backfill: every booking that exists BEFORE this migration is a settled record.
-- Mark them all as already-processed so the sweeper only ever acts on NEW orphans
-- created after this point (never touches historical paid/manual pendings).
UPDATE public.bookings
  SET pipeline_processed_at = COALESCE(updated_at, created_at)
  WHERE pipeline_processed_at IS NULL;

-- Partial index so the sweeper can cheaply locate unprocessed pending bookings
-- without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_bookings_pipeline_unprocessed
  ON public.bookings (created_at)
  WHERE pipeline_processed_at IS NULL AND current_status = 'pending';

COMMENT ON COLUMN public.bookings.pipeline_processed_at IS
  'Timestamp the auto-decision pipeline claimed this booking. NULL = pipeline has not run yet (orphan candidate). Set atomically by processBooking for idempotency.';
