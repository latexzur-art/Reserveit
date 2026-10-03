ALTER TABLE score_reset_requests
  ADD COLUMN IF NOT EXISTS reset_type text NOT NULL DEFAULT 'consecutive'
  CHECK (reset_type IN ('consecutive', 'cancellation_rate'));
