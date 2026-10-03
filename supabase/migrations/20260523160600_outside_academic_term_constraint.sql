-- =====================================================
-- Outside-Academic-Term Hard Constraint
-- =====================================================
-- Adds a hard constraint that blocks booking_purpose IN (academic, school_event_block-not, department_use)
-- bookings whose date falls outside the active term's [start_date, end_date].
-- The runner function checkOutsideAcademicTerm exempts school_event / personal / commercial / community
-- purposes, so this rule applies broadly but only triggers for school-use bookings.
-- =====================================================

INSERT INTO public.approval_constraint_rules (
  code, name, description, constraint_type, constraint_category, applies_to,
  is_active, rejection_message, priority
)
VALUES (
  'OUTSIDE_ACADEMIC_TERM',
  'Outside Academic Term',
  'Academic and department-use bookings cannot be made for dates outside the active academic term. Use a special school event request for dates outside the term.',
  'hard', 'temporal', 'all',
  true,
  'This date falls outside the active academic term. Pick a date inside the current term, or request a special school event for off-term use.',
  11
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  applies_to = EXCLUDED.applies_to,
  is_active = EXCLUDED.is_active,
  rejection_message = EXCLUDED.rejection_message,
  priority = EXCLUDED.priority;
