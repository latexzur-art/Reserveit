-- =====================================================
-- Phase 1.2: Create Equipment Status Log Table
-- =====================================================
-- Description: Audit trail for equipment state changes
-- Date: 2026-01-30
-- =====================================================

-- Create equipment_status_log table
CREATE TABLE IF NOT EXISTS public.equipment_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  previous_status_id UUID REFERENCES public.equipment_status_types(id) ON DELETE SET NULL,
  new_status_id UUID NOT NULL REFERENCES public.equipment_status_types(id) ON DELETE RESTRICT,
  changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT, -- Why status changed
  booking_id UUID, -- Will reference bookings table (FK added later)
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS equipment_status_log_equipment_id_idx ON public.equipment_status_log(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_status_log_changed_at_idx ON public.equipment_status_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS equipment_status_log_booking_id_idx ON public.equipment_status_log(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipment_status_log_changed_by_idx ON public.equipment_status_log(changed_by_user_id);

-- Enable Row Level Security
ALTER TABLE public.equipment_status_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view equipment status logs"
  ON public.equipment_status_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage equipment status logs"
  ON public.equipment_status_log FOR ALL
  USING (auth.role() = 'service_role');

-- Function to log equipment status change and update equipment
CREATE OR REPLACE FUNCTION public.update_equipment_status(
  p_equipment_id UUID,
  p_new_status_code TEXT,
  p_changed_by_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status_id UUID;
  v_new_status_id UUID;
BEGIN
  -- Get current status
  SELECT current_status_id INTO v_current_status_id
  FROM public.equipment
  WHERE id = p_equipment_id;

  IF v_current_status_id IS NULL THEN
    RAISE EXCEPTION 'Equipment not found';
  END IF;

  -- Get new status ID
  SELECT id INTO v_new_status_id
  FROM public.equipment_status_types
  WHERE status_code = p_new_status_code;

  IF v_new_status_id IS NULL THEN
    RAISE EXCEPTION 'Invalid status code: %', p_new_status_code;
  END IF;

  -- Don't log if status hasn't changed
  IF v_current_status_id = v_new_status_id THEN
    RETURN false;
  END IF;

  -- Log the status change
  INSERT INTO public.equipment_status_log (
    equipment_id,
    previous_status_id,
    new_status_id,
    changed_by_user_id,
    reason,
    booking_id
  ) VALUES (
    p_equipment_id,
    v_current_status_id,
    v_new_status_id,
    p_changed_by_user_id,
    p_reason,
    p_booking_id
  );

  -- Update equipment current status
  UPDATE public.equipment
  SET current_status_id = v_new_status_id,
      updated_at = NOW()
  WHERE id = p_equipment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get equipment status history
CREATE OR REPLACE FUNCTION public.get_equipment_status_history(p_equipment_id UUID)
RETURNS TABLE(
  changed_at TIMESTAMP WITH TIME ZONE,
  previous_status TEXT,
  new_status TEXT,
  changed_by TEXT,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    esl.changed_at,
    ps.status_name as previous_status,
    ns.status_name as new_status,
    COALESCE(u.full_name, 'System') as changed_by,
    esl.reason
  FROM public.equipment_status_log esl
  LEFT JOIN public.equipment_status_types ps ON esl.previous_status_id = ps.id
  JOIN public.equipment_status_types ns ON esl.new_status_id = ns.id
  LEFT JOIN public.users u ON esl.changed_by_user_id = u.id
  WHERE esl.equipment_id = p_equipment_id
  ORDER BY esl.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.equipment_status_log IS 'Audit trail for equipment status changes';
COMMENT ON COLUMN public.equipment_status_log.booking_id IS 'Related booking if status change is booking-related';
COMMENT ON FUNCTION public.update_equipment_status IS 'Update equipment status with automatic logging';
COMMENT ON FUNCTION public.get_equipment_status_history IS 'Get full status history for an equipment item';
