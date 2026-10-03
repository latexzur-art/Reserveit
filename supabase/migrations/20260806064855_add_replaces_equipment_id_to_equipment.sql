-- =====================================================
-- Add replaces_equipment_id to equipment (replacement trail)
-- =====================================================
-- Description: Optional traceability link so a replacement item points at
--   the retired one it superseded.
-- Date: 2026-08-06
-- =====================================================

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS replaces_equipment_id UUID
  REFERENCES public.equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS equipment_replaces_equipment_id_idx
  ON public.equipment(replaces_equipment_id)
  WHERE replaces_equipment_id IS NOT NULL;

COMMENT ON COLUMN public.equipment.replaces_equipment_id IS 'The retired equipment item this one replaced (audit trail)';
