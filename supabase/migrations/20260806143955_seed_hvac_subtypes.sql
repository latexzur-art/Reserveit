-- =====================================================
-- Seed HVAC subtype presets (building-scoped)
-- =====================================================
-- Description: Type DEFINITIONS only (no equipment units) so Building Admin can
--   pick the kind of HVAC from a real dropdown instead of always typing a
--   custom type. All managed_by='building' so they stay in the BA HVAC scope.
--   The generic 'HVAC' type is kept as a catch-all.
-- Date: 2026-08-06
-- =====================================================

INSERT INTO public.equipment_types (type_code, type_name, description, icon, managed_by) VALUES
  ('SPLIT_TYPE_AC',  'Split-type Aircon',     'Wall-mounted split-type air conditioner',        'ac_unit', 'building'),
  ('WINDOW_TYPE_AC', 'Window-type Aircon',    'Window-mounted air conditioner',                 'ac_unit', 'building'),
  ('CASSETTE_AC',    'Cassette / Ceiling AC', 'Ceiling-mounted cassette air conditioner',       'ac_unit', 'building'),
  ('CENTRALIZED_AC', 'Centralized Aircon',    'Central / ducted air-conditioning outlet',       'ac_unit', 'building')
ON CONFLICT (type_code) DO UPDATE SET
  type_name = EXCLUDED.type_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  managed_by = EXCLUDED.managed_by,
  updated_at = NOW();
