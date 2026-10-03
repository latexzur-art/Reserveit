-- Add cancellation_requested to booking_status enum
-- Used when a user submits an emergency cancellation request; reverted on withdraw/deny
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancellation_requested';
