-- Add SCHOOL_EVENT_BLOCK hard constraint rule
-- Catches school event blocks before the generic BOOKING_CONFLICT (priority 20)
-- so external clients get a clear "reserved for school event" message.

INSERT INTO public.approval_constraint_rules
  (code, name, constraint_type, constraint_category, applies_to, is_active, priority, is_reroutable, rejection_message)
VALUES
  ('SCHOOL_EVENT_BLOCK', 'School Event Block', 'hard', 'facility', 'all', true, 15, false,
   'This facility is reserved for a school event on the selected date and time.')
ON CONFLICT (code) DO NOTHING;
