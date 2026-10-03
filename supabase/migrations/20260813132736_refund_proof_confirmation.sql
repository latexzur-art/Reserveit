-- Refund proof & client confirmation lifecycle
-- Adds status column to payment_refunds and fixes the auto-refund trigger
-- so that payments only flip to 'refunded' when the client confirms receipt.

-- 1. Add refund_processing to payment_status enum
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_processing';

-- 2. Add status column to payment_refunds
ALTER TABLE public.payment_refunds
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_proof'
    CHECK (status IN ('pending_proof', 'proof_uploaded', 'confirmed', 'disputed'));

-- 3. Add proof upload timestamp and client confirmation timestamp
ALTER TABLE public.payment_refunds
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_disputed_at TIMESTAMPTZ;

-- 4. Migrate existing refunds to 'confirmed' (they were already processed)
UPDATE public.payment_refunds SET status = 'confirmed' WHERE status = 'pending_proof';

-- 5. Fix trigger: only flip payment to 'refunded' when client confirms
CREATE OR REPLACE FUNCTION public.handle_payment_refund_inserted()
RETURNS TRIGGER AS $$
BEGIN
  -- Only mark payment as refunded when refund is confirmed by client
  IF NEW.status = 'confirmed' THEN
    UPDATE public.payments SET payment_status = 'refunded', updated_at = NOW() WHERE id = NEW.payment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- 6. New trigger for status changes (not just inserts)
CREATE OR REPLACE FUNCTION public.handle_payment_refund_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    UPDATE public.payments SET payment_status = 'refunded', updated_at = NOW() WHERE id = NEW.payment_id;
  ELSIF NEW.status = 'proof_uploaded' AND OLD.status IS DISTINCT FROM 'proof_uploaded' THEN
    UPDATE public.payments SET payment_status = 'refund_processing', updated_at = NOW() WHERE id = NEW.payment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_payment_refund_status_change ON public.payment_refunds;
CREATE TRIGGER trigger_payment_refund_status_change
  AFTER UPDATE OF status ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_refund_status_change();

-- 7. Index for finding refunds awaiting client confirmation
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status
  ON public.payment_refunds(status) WHERE status IN ('proof_uploaded', 'pending_proof');
