DO $$ BEGIN
  ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'qr_manual';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending_review';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_requested';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- 'refunded' already exists (20260516000001_emergency_reschedule_enums.sql)
-- 'failed' (existing) is reused as "QR proof rejected, please resubmit"
