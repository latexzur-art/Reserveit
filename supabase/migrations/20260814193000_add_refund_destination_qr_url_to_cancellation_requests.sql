-- Add refund_destination_qr_url column to cancellation_requests table
ALTER TABLE public.cancellation_requests
  ADD COLUMN IF NOT EXISTS refund_destination_qr_url TEXT;
