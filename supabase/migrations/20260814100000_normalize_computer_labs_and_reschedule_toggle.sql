-- =====================================================
-- Migration: Normalize computer lab names + add reschedule auto-approve toggle
-- =====================================================
-- 1. Strip specific descriptions from computer labs (103, 303, 304, 308, 309)
-- 2. Add system_settings toggle for reschedule auto-approval
-- =====================================================

-- 1. Normalize computer lab names
UPDATE public.facilities
SET description = 'Computer laboratory'
WHERE room_number IN ('103', '303', '304', '308', '309')
  AND facility_type_id = (SELECT id FROM public.facility_types WHERE name = 'computer_lab' LIMIT 1);

-- 2. Add reschedule auto-approve toggle (default ON)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'reschedule_auto_approve',
  'true',
  'When true, teacher reschedules are auto-approved. When false, they require Building Admin approval.'
)
ON CONFLICT (key) DO NOTHING;
