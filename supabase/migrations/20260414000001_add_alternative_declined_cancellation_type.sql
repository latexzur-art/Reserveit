-- =====================================================
-- Fix: Add alternative_declined cancellation type
-- =====================================================
-- When a faculty member declines an alternative facility suggestion the booking
-- was previously cancelled with type 'facility_unavailable', which:
--   1. Misrepresents the reason (it was a user choice, not a system failure)
--   2. Misleads admins reading audit logs or cancellation reports
--
-- A new value 'alternative_declined' makes the intent explicit.
-- The consecutive_cancellations counter is NOT incremented for this type
-- (preserved fairness — the user never chose the original facility mismatch).
-- =====================================================

ALTER TYPE cancellation_type ADD VALUE IF NOT EXISTS 'alternative_declined';
