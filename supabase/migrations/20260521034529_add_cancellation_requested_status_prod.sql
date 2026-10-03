-- Applied via SQL editor on prod. Local equivalent: 20260521030000_add_cancellation_requested_status.sql
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancellation_requested';
