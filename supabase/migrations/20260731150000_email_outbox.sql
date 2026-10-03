-- =====================================================
-- F5 — Critical email delivery guarantee (lightweight outbox)
-- =====================================================
-- Supports plans/booking-pipeline-decision-time-audit.md Phase 4, F5.
--
-- Problem: every Brevo send in the booking pipeline is fire-and-forget with only
-- `.catch(console.error)` — a Brevo outage silently loses the approval/rejection
-- email with no record it ever should have gone out and no retry.
--
-- Fix (the plan's "lightweight retry + admin alert" option, not a full outbox for
-- every notification — scoped to the priority tier the plan calls out: booking
-- decision emails to the requester). When sendBrevoEmail reports a real failure
-- (not the `skipped` case, which means Brevo isn't configured at all and retrying
-- won't help), the caller persists a row here instead of just logging. A cron sweep
-- retries pending rows and dead-letters ones that exhaust their attempt budget.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notification_email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  source_type TEXT NOT NULL,           -- e.g. 'booking_decision'
  source_id UUID,                      -- e.g. booking id, for admin triage
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_email_outbox_pending
  ON public.notification_email_outbox (created_at)
  WHERE status = 'pending';

ALTER TABLE public.notification_email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages the email outbox"
  ON public.notification_email_outbox FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.notification_email_outbox IS
  'F5: retry queue for critical (booking-decision) emails that failed to send via Brevo. Swept by /api/cron/notification-outbox-retry.';
