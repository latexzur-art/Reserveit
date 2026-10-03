-- =====================================================
-- Special Event Approval Workflow
-- =====================================================
-- Adds per-event approval tracking columns to bookings so Program Head
-- special-event submissions can be reviewed by Academic Head / Building Admin.
-- AH and BA events skip the approval queue (event_requires_approval = false).
-- =====================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS event_requires_approval   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS event_approval_status     TEXT
    CHECK (event_approval_status IN ('pending', 'approved', 'declined') OR event_approval_status IS NULL),
  ADD COLUMN IF NOT EXISTS event_decision_notes      TEXT,
  ADD COLUMN IF NOT EXISTS event_decided_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_decided_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_requested_by_role   TEXT;

-- Index for the pending-review queue used by AH/BA dashboards
CREATE INDEX IF NOT EXISTS bookings_event_approval_pending_idx
  ON public.bookings (event_approval_status)
  WHERE booking_type = 'school_event_block' AND event_approval_status = 'pending';
