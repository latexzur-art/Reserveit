-- =====================================================
-- Migration: Add New Equipment Types
-- Date: 2026-05-11
-- =====================================================

INSERT INTO public.equipment_types (type_code, type_name, description, icon) VALUES
  ('FOLDING_TABLE', 'Folding Table', 'Standard folding table for events', 'table'),
  ('ROUND_TABLE', 'Round Table', 'Circular table for banquets', 'table'),
  ('MONOBLOC_CHAIR', 'Monobloc Chair', 'Stackable plastic monobloc chair', 'armchair'),
  ('SCHOOL_CHAIR_TYPE_1', 'School Chairs Type 1', 'Standard school chair with armrest', 'chair'),
  ('SCHOOL_CHAIR_TYPE_2', 'School Chairs Type 2', 'Adjustable school chair', 'chair'),
  ('PODIUM_ROSTRUM', 'Podium / Rostrum', 'Speaker podium for ceremonies', 'lectern'),
  ('MISCELLANEOUS', 'Miscellaneous', 'Various small equipment items', 'package'),
  ('OTHER_SPECIFY', 'OTHER (SPECIFY)', 'Custom equipment type (Specify in registration)', 'more-horizontal')
ON CONFLICT (type_code) DO UPDATE SET
  type_name = EXCLUDED.type_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon;
