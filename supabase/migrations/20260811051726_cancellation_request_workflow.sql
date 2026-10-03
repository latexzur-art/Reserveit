-- Cancellation Request Approval Workflow
-- Users submit cancellation requests with a reason; Academic Head reviews.
-- Auto-approve with no strike after 24 hours if no response.

-- =====================================================
-- 1. New cancellation_type value
-- =====================================================
ALTER TYPE cancellation_type ADD VALUE IF NOT EXISTS 'cancellation_approved';

-- =====================================================
-- 2. cancellation_requests table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved_no_strike', 'approved_with_strike', 'rejected', 'cancelled', 'auto_approved')),
  original_status TEXT NOT NULL,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reason must be at least 20 characters
ALTER TABLE public.cancellation_requests
  ADD CONSTRAINT cancellation_requests_reason_min_length
  CHECK (length(reason) >= 20) NOT VALID;

-- One pending request per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_cancellation_requests_one_pending
  ON public.cancellation_requests(booking_id)
  WHERE status = 'pending';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status
  ON public.cancellation_requests(status);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_user
  ON public.cancellation_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_booking
  ON public.cancellation_requests(booking_id);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_created_at
  ON public.cancellation_requests(created_at)
  WHERE status = 'pending';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_cancellation_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_cancellation_requests_updated_at
  BEFORE UPDATE ON public.cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cancellation_requests_updated_at();

-- =====================================================
-- 3. RLS Policies
-- =====================================================
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "Users read own cancellation requests"
  ON public.cancellation_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create requests for their own bookings
CREATE POLICY "Users create own cancellation requests"
  ON public.cancellation_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own pending requests
CREATE POLICY "Users cancel own pending requests"
  ON public.cancellation_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Academic head can read all requests
CREATE POLICY "Academic head reads all cancellation requests"
  ON public.cancellation_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'academic_head' AND ur.is_active = TRUE
  ));

-- Academic head can update (review) requests
CREATE POLICY "Academic head reviews cancellation requests"
  ON public.cancellation_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'academic_head' AND ur.is_active = TRUE
  ));

-- Service role full access
CREATE POLICY "Service role manages cancellation requests"
  ON public.cancellation_requests FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- =====================================================
-- 4. Comments
-- =====================================================
COMMENT ON TABLE public.cancellation_requests IS
  'User-initiated cancellation requests reviewed by Academic Head. Auto-approved after 24h.';

COMMENT ON COLUMN public.cancellation_requests.original_status IS
  'Booking status at the time of request, used to revert on rejection';

COMMENT ON COLUMN public.cancellation_requests.auto_approved IS
  'TRUE if auto-approved by cron due to 24h timeout';
