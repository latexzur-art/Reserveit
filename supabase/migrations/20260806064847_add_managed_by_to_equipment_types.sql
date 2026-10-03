-- =====================================================
-- Add managed_by scope to equipment_types
-- =====================================================
-- Description: Classify each equipment type by owning office:
--   'pamo'     -> non-tech assets (PAMO / Purchasing & Asset Mgmt Officer)
--   'it'       -> tech assets (IT Admin / user_manager)
--   'building' -> building fixtures e.g. HVAC (Building Admin)
-- Date: 2026-08-06
-- =====================================================

-- 1. Column + check constraint (constant default fills existing rows)
ALTER TABLE public.equipment_types
  ADD COLUMN IF NOT EXISTS managed_by TEXT NOT NULL DEFAULT 'pamo'
  CHECK (managed_by IN ('pamo','it','building'));

COMMENT ON COLUMN public.equipment_types.managed_by IS
  'Owning office scope: pamo (non-tech), it (tech), building (fixtures/HVAC)';

-- 2. Reclassify existing tech types
UPDATE public.equipment_types
  SET managed_by = 'it', updated_at = NOW()
  WHERE type_code IN ('LAPTOP','WEBCAM');

-- 3. Seed IT-managed tech type definitions + the building HVAC fixture type
INSERT INTO public.equipment_types (type_code, type_name, description, icon, managed_by) VALUES
  ('TV', 'Television', 'Wall/stand-mounted television display', 'tv', 'it'),
  ('MONITOR', 'Monitor', 'Computer display monitor', 'desktop_windows', 'it'),
  ('DESKTOP_COMPUTER', 'Desktop Computer', 'Desktop PC / workstation', 'computer', 'it'),
  ('PC_PARTS', 'PC Parts', 'Computer components and peripherals', 'memory', 'it'),
  ('HVAC', 'HVAC Unit', 'Heating, ventilation and air-conditioning unit', 'ac_unit', 'building')
ON CONFLICT (type_code) DO UPDATE SET
  type_name = EXCLUDED.type_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  managed_by = EXCLUDED.managed_by,
  updated_at = NOW();
