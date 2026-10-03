-- Prevent duplicate active payment rows per booking.
-- A booking can have at most one payment row in ('pending', 'completed') at any time.
-- Failed/cancelled rows are excluded so retries can re-create after a failure.
--
-- Backstops the idempotent insert in app/api/academic-head/review-booking/route.ts
-- and respond-proposal/route.ts: if a network retry races, the duplicate insert
-- now hits Postgres 23505 instead of silently creating a second invoice.

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_active_per_booking
  ON payments (booking_id)
  WHERE payment_status IN ('pending', 'completed');
