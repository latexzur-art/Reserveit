-- =====================================================
-- Score Reset Requests
-- =====================================================
-- Description: Faculty / Program Head can request a reset of their
-- consecutive_cancellations counter. Academic head approves / declines.
-- Also extends restriction_action enum with 'score_reset' and 'score_reset_bulk'
-- so the existing restriction_logs audit table can be reused.
-- =====================================================

-- Extend restriction_action enum
ALTER TYPE restriction_action ADD VALUE IF NOT EXISTS 'score_reset';
ALTER TYPE restriction_action ADD VALUE IF NOT EXISTS 'score_reset_bulk';

-- Extend notifications.source_type CHECK constraint to allow score-reset events
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_source_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_source_type_check CHECK (
    source_type IS NULL OR source_type IN (
      'booking',
      'schedule_upload',
      'schedule_entry',
      'facility_block',
      'broadcast',
      'admin_message',
      'restriction',
      'payment',
      'system',
      'override',
      'message',
      'schedule_conflict',
      'appeal',
      'change_request',
      'maintenance',
      'user',
      'score_reset',
      'score_reset_request'
    )
  );

-- Status enum for reset requests
DO $$ BEGIN
  CREATE TYPE score_reset_request_status AS ENUM ('pending', 'approved', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.score_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  count_at_request INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status score_reset_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_reset_requests_user_id
  ON public.score_reset_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_score_reset_requests_status
  ON public.score_reset_requests(status);

-- Only one pending request per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_score_reset_requests_pending_per_user
  ON public.score_reset_requests(user_id)
  WHERE status = 'pending';

ALTER TABLE public.score_reset_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own score reset requests"
  ON public.score_reset_requests FOR SELECT
  USING (user_id = auth.uid());

-- Users can create requests for themselves
CREATE POLICY "Users can create own score reset requests"
  ON public.score_reset_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Authenticated reviewers (academic heads, admins) can read everything;
-- writes from the API path go through the service-role client.
CREATE POLICY "Authenticated users can view score reset requests"
  ON public.score_reset_requests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage score reset requests"
  ON public.score_reset_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_score_reset_requests_updated_at
  BEFORE UPDATE ON public.score_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.score_reset_requests IS 'User-initiated requests to reset consecutive_cancellations; reviewed by academic head.';
