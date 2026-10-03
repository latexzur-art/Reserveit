-- Add 'displaced_refund' cancellation type for bookings cancelled by user
-- declining a school-event reschedule and requesting a refund instead.
ALTER TYPE cancellation_type ADD VALUE IF NOT EXISTS 'displaced_refund';
