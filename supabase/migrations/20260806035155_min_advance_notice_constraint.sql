-- =====================================================
-- Minimum Advance-Notice Hard Constraint
-- =====================================================
-- Blocks faculty / program-head reservations made with less than the
-- building-admin-configured minimum days of advance notice
-- (system_settings key `min_reservation_lead_days`, Sundays excluded).
--
-- The runner function checkMinAdvanceNotice exempts paid/rental facilities
-- (is_available_for_rental = true), and privileged roles (building_admin,
-- academic_head) bypass it via PRIVILEGE_BYPASSED in the checker. applies_to
-- is 'internal' since external users only book paid facilities (exempt anyway).
-- =====================================================

INSERT INTO public.approval_constraint_rules (
  code, name, description, constraint_type, constraint_category, applies_to,
  is_reroutable, is_active, rejection_message, priority
)
VALUES (
  'MIN_ADVANCE_NOTICE',
  'Minimum Advance Notice',
  'Reservations for non-paid facilities must be made at least the configured number of days in advance (Sundays excluded). Set by the building admin under Reservation Policy.',
  'hard', 'temporal', 'internal',
  false, true,
  'This date is too soon. Reservations require a minimum number of days'' advance notice — pick a later date.',
  10
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  applies_to = EXCLUDED.applies_to,
  is_reroutable = EXCLUDED.is_reroutable,
  is_active = EXCLUDED.is_active,
  rejection_message = EXCLUDED.rejection_message,
  priority = EXCLUDED.priority;
