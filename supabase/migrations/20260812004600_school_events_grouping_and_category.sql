-- School Events: group multi-facility/multi-date submissions and categorize block type.
-- group_id: shared by every bookings row created from one form submission (one date x one
-- facility each). NULL for legacy/Program-Head-submitted rows, which continue to display
-- individually.
-- block_category: display-only distinction between 'school_event' and 'exam_period'. Never used
-- in constraint/exclusion logic -- booking_purpose stays 'school_event' for both modes since other
-- call sites special-case that exact string.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS group_id UUID,
  ADD COLUMN IF NOT EXISTS block_category TEXT;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_block_category_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_block_category_check
  CHECK (block_category IS NULL OR block_category IN ('school_event', 'exam_period'));

CREATE INDEX IF NOT EXISTS idx_bookings_group_id ON public.bookings(group_id) WHERE group_id IS NOT NULL;
