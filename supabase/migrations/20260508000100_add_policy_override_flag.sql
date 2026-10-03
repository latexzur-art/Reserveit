-- =====================================================
-- P0-2: Audit-flag academic-head policy-override approvals
-- =====================================================
-- The autoDecisionRouter auto-approves any academic_head booking regardless
-- of score or scoring rules. Without an audit flag this is invisible — there
-- is no way to distinguish a normal score-driven auto_approval from a
-- policy-driven one. We add a boolean column so the admin dashboard can
-- surface these for periodic review (self-dealing / compliance check).
-- =====================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS policy_override BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.policy_override IS
  'True when the booking was approved by policy override (e.g., academic_head '
  'role auto-approval) rather than via score-driven auto-approval. Surfaces in '
  'admin dashboard for periodic review of privileged-role bookings.';

CREATE INDEX IF NOT EXISTS idx_bookings_policy_override
  ON public.bookings(policy_override, submitted_at DESC)
  WHERE policy_override = true;
