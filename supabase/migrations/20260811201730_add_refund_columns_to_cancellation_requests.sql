-- Payment-overhaul: refund-entitlement columns for cancellation_requests
-- (2026-08-11-qr-manual-payments-design.md)
-- The base cancellation_requests table already exists
-- (see 20260811051726_cancellation_request_workflow.sql); this migration only
-- adds the refund-entitlement columns needed for the payment overhaul.

ALTER TABLE public.cancellation_requests
  ADD COLUMN IF NOT EXISTS refund_window_met BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refund_destination_name TEXT,
  ADD COLUMN IF NOT EXISTS refund_destination_contact_number TEXT;
