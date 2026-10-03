-- =====================================================
-- Create equipment_movement_log table + assign fn
-- =====================================================
-- Description: Tracks equipment room assignments/movements (BA non-tech,
--   IT Admin tech). assign_equipment_facility() performs the move + logs it.
-- Date: 2026-08-06
-- =====================================================

CREATE TABLE IF NOT EXISTS public.equipment_movement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  from_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  to_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  moved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  moved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS equipment_movement_log_equipment_id_idx ON public.equipment_movement_log(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_movement_log_moved_at_idx ON public.equipment_movement_log(moved_at DESC);

ALTER TABLE public.equipment_movement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view equipment movement log"
  ON public.equipment_movement_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage equipment movement log"
  ON public.equipment_movement_log FOR ALL
  USING (auth.role() = 'service_role');

-- Perform an assignment/move and log it. Mirrors update_equipment_status().
CREATE OR REPLACE FUNCTION public.assign_equipment_facility(
  p_equipment_id UUID,
  p_to_facility_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_from_facility_id UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT TRUE, assigned_facility_id INTO v_exists, v_from_facility_id
  FROM public.equipment
  WHERE id = p_equipment_id;

  IF v_exists IS NULL THEN
    RAISE EXCEPTION 'Equipment not found';
  END IF;

  -- No-op if unchanged
  IF v_from_facility_id IS NOT DISTINCT FROM p_to_facility_id THEN
    RETURN false;
  END IF;

  INSERT INTO public.equipment_movement_log (
    equipment_id, from_facility_id, to_facility_id, moved_by_user_id, reason
  ) VALUES (
    p_equipment_id, v_from_facility_id, p_to_facility_id, p_user_id, p_reason
  );

  UPDATE public.equipment
    SET assigned_facility_id = p_to_facility_id, updated_at = NOW()
    WHERE id = p_equipment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON TABLE public.equipment_movement_log IS 'Audit trail for equipment facility assignments/movements';
COMMENT ON FUNCTION public.assign_equipment_facility IS 'Assign/move equipment to a facility with automatic movement logging';
