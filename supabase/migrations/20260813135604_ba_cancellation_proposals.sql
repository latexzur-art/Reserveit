-- BA-initiated cancellation proposals with booker confirmation
-- When the BA wants to cancel a paid booking, the booker must accept
-- (providing refund destination details) before the cancellation proceeds.

-- 1. Add cancellation_proposed to booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancellation_proposed';

-- 2. Create ba_cancellation_proposals table
CREATE TABLE IF NOT EXISTS public.ba_cancellation_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  refund_amount_centavos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'disputed', 'cancelled')),
  accepted_at TIMESTAMPTZ,
  refund_destination_name TEXT,
  refund_destination_contact_number TEXT,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One pending proposal per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_ba_cancel_proposals_one_pending
  ON public.ba_cancellation_proposals(booking_id)
  WHERE status = 'pending';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ba_cancel_proposals_booking
  ON public.ba_cancellation_proposals(booking_id);

CREATE INDEX IF NOT EXISTS idx_ba_cancel_proposals_status
  ON public.ba_cancellation_proposals(status);

-- 3. RLS
ALTER TABLE public.ba_cancellation_proposals ENABLE ROW LEVEL SECURITY;

-- Users can read proposals for their own bookings
CREATE POLICY "Users read own ba cancellation proposals"
  ON public.ba_cancellation_proposals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = ba_cancellation_proposals.booking_id AND b.user_id = auth.uid()
  ));

-- Users can update (accept/dispute) proposals for their own bookings
CREATE POLICY "Users respond to ba cancellation proposals"
  ON public.ba_cancellation_proposals FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = ba_cancellation_proposals.booking_id AND b.user_id = auth.uid()
  ));

-- Building admins can do everything
CREATE POLICY "Building admins manage ba cancellation proposals"
  ON public.ba_cancellation_proposals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name IN ('building_admin', 'it_admin') AND ur.is_active = TRUE
  ));

-- Service role
CREATE POLICY "Service role manages ba cancellation proposals"
  ON public.ba_cancellation_proposals FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Updated_at trigger
CREATE TRIGGER update_ba_cancellation_proposals_updated_at
  BEFORE UPDATE ON public.ba_cancellation_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_cancellation_requests_updated_at();
