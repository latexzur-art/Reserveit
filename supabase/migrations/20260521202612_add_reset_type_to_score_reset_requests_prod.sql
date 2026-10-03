-- Applied via SQL editor on prod. Local equivalent: 20260522000000_add_reset_type_to_score_reset_requests.sql
ALTER TABLE score_reset_requests
  ADD COLUMN IF NOT EXISTS reset_type text NOT NULL DEFAULT 'consecutive'
  CHECK (reset_type IN ('consecutive', 'cancellation_rate'));
