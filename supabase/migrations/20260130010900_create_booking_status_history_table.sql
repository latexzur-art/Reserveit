-- =====================================================
-- Phase 1.2: Create Booking Status History Table
-- =====================================================
-- Description: Audit trail for booking status changes
-- Date: 2026-01-30
-- =====================================================

-- Create booking_status_history table
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  previous_status booking_status,
  new_status booking_status NOT NULL,
  changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL if system/AI
  changed_by_ai BOOLEAN DEFAULT false,
  reason TEXT,
  metadata JSONB DEFAULT '{}', -- Additional context (e.g., AI confidence score)
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS booking_status_history_booking_id_idx ON public.booking_status_history(booking_id);
CREATE INDEX IF NOT EXISTS booking_status_history_changed_at_idx ON public.booking_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS booking_status_history_booking_created_idx ON public.booking_status_history(booking_id, changed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view history for their own bookings
CREATE POLICY "Users can view own booking history"
  ON public.booking_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

-- Authenticated users can view history (for admin purposes)
CREATE POLICY "Authenticated users can view booking history"
  ON public.booking_status_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role has full access
CREATE POLICY "Service role can manage booking status history"
  ON public.booking_status_history FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update booking status with automatic history logging
CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id UUID,
  p_new_status booking_status,
  p_changed_by_user_id UUID DEFAULT NULL,
  p_changed_by_ai BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status booking_status;
BEGIN
  -- Get current status
  SELECT current_status INTO v_current_status
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Don't log if status hasn't changed
  IF v_current_status = p_new_status THEN
    RETURN false;
  END IF;

  -- Log the status change
  INSERT INTO public.booking_status_history (
    booking_id,
    previous_status,
    new_status,
    changed_by_user_id,
    changed_by_ai,
    reason,
    metadata
  ) VALUES (
    p_booking_id,
    v_current_status,
    p_new_status,
    p_changed_by_user_id,
    p_changed_by_ai,
    p_reason,
    p_metadata
  );

  -- Update booking status and timestamp
  UPDATE public.bookings
  SET current_status = p_new_status,
      approved_at = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_at END,
      rejected_at = CASE WHEN p_new_status = 'rejected' THEN NOW() ELSE rejected_at END,
      cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
      completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log status changes on bookings table
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    INSERT INTO public.booking_status_history (
      booking_id,
      previous_status,
      new_status,
      changed_by_user_id,
      changed_by_ai,
      reason
    ) VALUES (
      NEW.id,
      OLD.current_status,
      NEW.current_status,
      NULL, -- Will be set via the update_booking_status function if needed
      false,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger is optional if using update_booking_status function
-- CREATE TRIGGER trigger_log_booking_status_change
--   AFTER UPDATE OF current_status ON public.bookings
--   FOR EACH ROW
--   EXECUTE FUNCTION public.log_booking_status_change();

-- Function to get booking status history
CREATE OR REPLACE FUNCTION public.get_booking_status_history(p_booking_id UUID)
RETURNS TABLE(
  changed_at TIMESTAMP WITH TIME ZONE,
  previous_status TEXT,
  new_status TEXT,
  changed_by TEXT,
  changed_by_ai BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bsh.changed_at,
    bsh.previous_status::TEXT,
    bsh.new_status::TEXT,
    COALESCE(u.full_name, CASE WHEN bsh.changed_by_ai THEN 'AI System' ELSE 'System' END) as changed_by,
    bsh.changed_by_ai,
    bsh.reason
  FROM public.booking_status_history bsh
  LEFT JOIN public.users u ON bsh.changed_by_user_id = u.id
  WHERE bsh.booking_id = p_booking_id
  ORDER BY bsh.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.booking_status_history IS 'Audit trail for booking status changes';
COMMENT ON COLUMN public.booking_status_history.changed_by_ai IS 'True if status was changed by AI approval system';
COMMENT ON COLUMN public.booking_status_history.metadata IS 'Additional context like AI confidence score';
COMMENT ON FUNCTION public.update_booking_status IS 'Update booking status with automatic history logging';
COMMENT ON FUNCTION public.get_booking_status_history IS 'Get full status history for a booking';
